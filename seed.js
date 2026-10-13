const axios = require('axios');
const mysql = require('mysql2');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'RP738964$',
    database: 'angelina_pokemonweb'
});

// ---------- Helpers ----------
const titleCase = s => s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const regionalLabels = { alola: 'Alolan', galar: 'Galarian', hisui: 'Hisuian', paldea: 'Paldean' };

// Species where ONLY the Gigantamax form should be kept (hides cosplay, caps, starter, etc.)
// Add more species slugs here if you want the same treatment (e.g. 'eevee' keeps only gmax).
const gmaxOnlySpecies = new Set(['pikachu']);

// Turns a variety suffix (e.g. "droopy", "mega-x", "alola", "gmax") into a display label
function formLabelFromSuffix(suffix, baseDisplay) {
    if (suffix.startsWith('mega')) {
        const letter = suffix.split('-')[1]; // x / y / z / undefined
        return `Mega ${baseDisplay}${letter ? ' ' + letter.toUpperCase() : ''}`;
    }
    if (suffix === 'gmax' || suffix === 'gigantamax') return 'Gigantamax';
    if (suffix === 'exclamation') return '!';   // Unown
    if (suffix === 'question') return '?';      // Unown
    return suffix
        .split('-')
        .map(w => regionalLabels[w] || w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

async function seedPokemon(id) {
    try {
        const response = await axios.get(`https://pokeapi.co/api/v2/pokemon/${id}`);
        const data = response.data;

        const speciesResponse = await axios.get(`https://pokeapi.co/api/v2/pokemon-species/${id}`);
        const speciesData = speciesResponse.data;
        const pokedexData = speciesResponse.data;

        const speciesSlug = speciesData.name;          // e.g. "tatsugiri" (data.name would be "tatsugiri-curly")
        const baseDisplay = titleCase(speciesSlug);

        const pokemonId = data.id;
        const name = speciesSlug;
        const height = data.height / 10;
        const weight = data.weight / 10;
        const hp = data.stats[0].base_stat;
        const attack = data.stats[1].base_stat;
        const defense = data.stats[2].base_stat;
        const spAtk = data.stats[3].base_stat;
        const spDef = data.stats[4].base_stat;
        const speed = data.stats[5].base_stat;

        // Official 2D artwork only (no pixel sprites, no 3D Home renders)
        const image = data.sprites.other?.['official-artwork']?.front_default || null;
        const shinyImage = data.sprites.other?.['official-artwork']?.front_shiny || null;

        const genName = speciesData.generation.name;
        const regionMap = {
            'generation-i': { region: 'Kanto', gen: 1 },
            'generation-ii': { region: 'Johto', gen: 2 },
            'generation-iii': { region: 'Hoenn', gen: 3 },
            'generation-iv': { region: 'Sinnoh', gen: 4 },
            'generation-v': { region: 'Unova', gen: 5 },
            'generation-vi': { region: 'Kalos', gen: 6 },
            'generation-vii': { region: 'Alola', gen: 7 },
            'generation-viii': { region: 'Galar', gen: 8 },
            'generation-ix': { region: 'Paldea', gen: 9 }
        };
        const genInfo = regionMap[genName] || { region: 'Unknown', gen: 1 };
        const region = genInfo.region;
        const generation = genInfo.gen;

        let evolvedFromId = null;
        if (speciesData.evolves_from_species) {
            const urlParts = speciesData.evolves_from_species.url.split('/');
            const parentId = parseInt(urlParts[urlParts.length - 2]);
            if (parentId <= 1025) {
                evolvedFromId = parentId;
            }
        }

        const englishEntry = pokedexData.flavor_text_entries.find(entry => entry.language.name === 'en');
        const pokedexDescription = englishEntry?.flavor_text ? englishEntry.flavor_text.replace(/[\n\f]/g, ' ') : 'No description available.';

        const cryLatest = data.cries?.latest || null;
        const cryLegacy = data.cries?.legacy || null;

        // Pokémon with no true "default" form (Tatsugiri, Toxtricity, Oricorio...):
        // PokeAPI's default variety is e.g. "tatsugiri-curly". Store its label so the
        // dropdown can show "Curly" instead of "Default".
        const defaultVariety = (speciesData.varieties || []).find(v => v.is_default);
        let defaultFormName = null; // stays null for normal Pokémon -> dropdown shows "Default"
        if (defaultVariety && defaultVariety.pokemon.name !== speciesSlug) {
            const dSuffix = defaultVariety.pokemon.name.slice(speciesSlug.length + 1);
            defaultFormName = formLabelFromSuffix(dSuffix, baseDisplay);
        }
        // Pokémon whose forms live in the "forms" list instead of "varieties" (Unown "A", Vivillon, Flabébé...)
        const firstForm = data.forms?.[0]?.name;
        if (!defaultFormName && firstForm && firstForm !== data.name && firstForm.startsWith(`${speciesSlug}-`)) {
            defaultFormName = formLabelFromSuffix(firstForm.slice(speciesSlug.length + 1), baseDisplay);
        }

        const pokemonSql = `INSERT INTO pokemons (pokemon_id, pokemon_name, pokemon_img, pokemon_shiny_img, pokemon_height, pokemon_weight, pokemon_hp, pokemon_atk, pokemon_def, pokemon_sp_atk, pokemon_sp_def, pokemon_speed, pokemon_generation, pokemon_region, pokemon_evolved_from_id, pokemon_desc, pokemon_cry_latest, pokemon_cry_legacy, pokemon_default_form_name) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
                    AS new_data
                    ON DUPLICATE KEY UPDATE 
                    pokemon_name = new_data.pokemon_name,
                    pokemon_img = new_data.pokemon_img,
                    pokemon_shiny_img = new_data.pokemon_shiny_img,
                    pokemon_region = new_data.pokemon_region,
                    pokemon_evolved_from_id = new_data.pokemon_evolved_from_id,
                    pokemon_desc = new_data.pokemon_desc,
                    pokemon_cry_latest = new_data.pokemon_cry_latest,
                    pokemon_cry_legacy = new_data.pokemon_cry_legacy,
                    pokemon_default_form_name = new_data.pokemon_default_form_name`;

        await db.promise().query(pokemonSql, [pokemonId, name, image, shinyImage, height, weight, hp, attack, defense, spAtk, spDef, speed, generation, region, evolvedFromId, pokedexDescription, cryLatest, cryLegacy, defaultFormName]);

        // Types
        for (const typeInfo of data.types) {
            const typeName = typeInfo.type.name;
            const typeSql = `INSERT INTO types (type_name) VALUES (?) ON DUPLICATE KEY UPDATE type_id=LAST_INSERT_ID(type_id)`;
            await db.promise().query(typeSql, [typeName]);

            const [typeRows] = await db.promise().query(`SELECT type_id FROM types WHERE type_name = ?`, [typeName]);
            if (typeRows.length > 0) {
                await db.promise().query(`INSERT IGNORE INTO pokemon_types (pokemon_id, type_id) VALUES (?, ?)`, [pokemonId, typeRows[0].type_id]);
            }
        }

        // Abilities
        for (const abilityInfo of data.abilities) {
            const rawAbilityName = abilityInfo.ability?.name || '';
            const abilityName = rawAbilityName.replace(/-/g, ' ');
            const isHidden = abilityInfo.is_hidden ? 1 : 0;

            const abilitySql = `INSERT INTO abilities (ability_name) VALUES (?) ON DUPLICATE KEY UPDATE ability_id=LAST_INSERT_ID(ability_id)`;
            await db.promise().query(abilitySql, [abilityName]);

            const [abilityRows] = await db.promise().query(`SELECT ability_id FROM abilities WHERE ability_name = ?`, [abilityName]);
            if (abilityRows.length > 0) {
                await db.promise().query(`INSERT IGNORE INTO pokemon_abilities (pokemon_id, ability_id, is_hidden) VALUES (?, ?, ?)`, [pokemonId, abilityRows[0].ability_id, isHidden]);
            }
        }

        // ---------- Alternative forms (varieties, Megas, Gigantamax, regional, etc.) ----------
        const addedForms = new Set();
        // x = optional per-form data (stats, height, weight, cries). Anything left null falls back to the base Pokémon on the page.
        const saveForm = async (formName, formImg, formShinyImg, x = {}) => {
            if (!formName || !formImg) return;
            const normalizedKey = formName.toLowerCase();
            if (addedForms.has(normalizedKey)) return;
            addedForms.add(normalizedKey);

            try {
                await db.promise().query(
                    `INSERT INTO pokemon_forms (pokemon_id, form_name, form_img, form_shiny_img, form_hp, form_atk, form_def, form_sp_atk, form_sp_def, form_speed, form_height, form_weight, form_cry_latest, form_cry_legacy) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
                     AS new_form
                     ON DUPLICATE KEY UPDATE 
                        form_img = new_form.form_img, form_shiny_img = new_form.form_shiny_img,
                        form_hp = new_form.form_hp, form_atk = new_form.form_atk, form_def = new_form.form_def,
                        form_sp_atk = new_form.form_sp_atk, form_sp_def = new_form.form_sp_def, form_speed = new_form.form_speed,
                        form_height = new_form.form_height, form_weight = new_form.form_weight,
                        form_cry_latest = new_form.form_cry_latest, form_cry_legacy = new_form.form_cry_legacy`,
                    [pokemonId, formName, formImg, formShinyImg,
                        x.hp ?? null, x.atk ?? null, x.def ?? null, x.spAtk ?? null, x.spDef ?? null, x.speed ?? null,
                        x.height ?? null, x.weight ?? null, x.cryLatest ?? null, x.cryLegacy ?? null]
                );
            } catch (formErr) {
                console.error(`Error saving ${formName} form for ${name}:`, formErr.message);
            }
        };

        for (const variety of speciesData.varieties || []) {
            const slug = variety.pokemon.name;         // e.g. "tatsugiri-droopy"

            // The default variety is already the base entry (labelled via pokemon_default_form_name)
            if (variety.is_default) continue;

            const suffix = slug.startsWith(`${speciesSlug}-`)
                ? slug.slice(speciesSlug.length + 1)
                : slug;

            // e.g. Pikachu: keep only Gigantamax, skip cosplay / caps / partner / etc.
            if (gmaxOnlySpecies.has(speciesSlug) && !suffix.startsWith('gmax')) continue;

            try {
                const { data: v } = await axios.get(variety.pokemon.url);

                // Official 2D artwork only
                const art = v.sprites.other?.['official-artwork'];
                if (!art?.front_default) continue;

                // Skip forms that just reuse the base image (avoids duplicate-looking entries)
                if (art.front_default === image) continue;

                // Per-form stats, size and cries (Mega stats, Gigantamax height/weight/cry, etc.)
                const stat = n => v.stats.find(s => s.stat.name === n)?.base_stat ?? null;

                await saveForm(formLabelFromSuffix(suffix, baseDisplay), art.front_default, art.front_shiny || null, {
                    hp: stat('hp'),
                    atk: stat('attack'),
                    def: stat('defense'),
                    spAtk: stat('special-attack'),
                    spDef: stat('special-defense'),
                    speed: stat('speed'),
                    height: v.height / 10,
                    weight: v.weight / 10,
                    cryLatest: v.cries?.latest || null,
                    cryLegacy: v.cries?.legacy || null
                });
            } catch (varErr) {
                console.error(`Error fetching variant ${slug}:`, varErr.message);
            }
        }

        // Forms listed under data.forms (Unown A-Z/!/?, Vivillon patterns, Flabébé colours, etc.).
        // These are NOT in speciesData.varieties, which is why they were missing.
        // The first entry is the default form, already used as the base entry.
        if (!gmaxOnlySpecies.has(speciesSlug)) {
            for (const f of (data.forms || []).slice(1)) {
                const suffix = f.name.startsWith(`${speciesSlug}-`)
                    ? f.name.slice(speciesSlug.length + 1)
                    : f.name;
                try {
                    const { data: fd } = await axios.get(f.url);

                    // Official 2D artwork only
                    const art = fd.sprites?.other?.['official-artwork'];
                    if (!art?.front_default || art.front_default === image) continue;

                    await saveForm(formLabelFromSuffix(suffix, baseDisplay), art.front_default, art.front_shiny || null);
                } catch (formErr) {
                    console.error(`Error fetching form ${f.name}:`, formErr.message);
                }
            }
        }

        console.log(`Successfully seeded ${name}!`);

    } catch (error) {
        console.error(`Failed to fetch Pokémon ID ${id}:`, error.message);
    }
}

async function runSeeder() {
    const requestedId = process.argv[2] ? Number(process.argv[2]) : null;
    if (requestedId !== null && (!Number.isInteger(requestedId) || requestedId < 1 || requestedId > 1025)) {
        console.error('Provide a Pokémon ID between 1 and 1025.');
        db.end();
        return;
    }

    try {
        await db.promise().query('SET FOREIGN_KEY_CHECKS = 0;');

        if (requestedId !== null) {
            await seedPokemon(requestedId);
        } else {
            for (let i = 1; i <= 1025; i++) {
                await seedPokemon(i);
            }
        }

        await db.promise().query('SET FOREIGN_KEY_CHECKS = 1;');
        console.log('Database seeding complete.');
    } catch (err) {
        console.error('Seeding error:', err.message);
    } finally {
        setTimeout(() => {
            db.end();
            console.log('Database connection closed.');
        }, 3000);
    }
}

runSeeder();