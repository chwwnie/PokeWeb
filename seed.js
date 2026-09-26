const axios = require('axios');
const mysql = require('mysql2');

// Database connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'RP738964$',
    database: 'angelina_pokemonweb'
});

async function seedPokemon(id) {
    try {
        // 1. Fetch main Pokémon data & species data
        const response = await axios.get(`https://pokeapi.co/api/v2/pokemon/${id}`);
        const data = response.data;

        const speciesResponse = await axios.get(`https://pokeapi.co/api/v2/pokemon-species/${id}`);
        const speciesData = speciesResponse.data;
        const pokedexData = speciesResponse.data;

        // Define pokemonId right at the top so it's accessible everywhere below!
        const pokemonId = data.id;
        const name = data.name;
        const height = data.height / 10;
        const weight = data.weight / 10;
        const hp = data.stats[0].base_stat;
        const attack = data.stats[1].base_stat;
        const defense = data.stats[2].base_stat;
        const spAtk = data.stats[3].base_stat;
        const spDef = data.stats[4].base_stat;
        const speed = data.stats[5].base_stat;
        const image = data.sprites.other['official-artwork'].front_default || data.sprites.front_default;
        const shinyImage = data.sprites.other['official-artwork'].front_shiny || data.sprites.front_shiny;
        const generation = 1;

        // Map generation to its official region name
        const genName = speciesData.generation.name; // e.g., 'generation-i'
        const regionMap = {
            'generation-i': 'Kanto',
            'generation-ii': 'Johto',
            'generation-iii': 'Hoenn',
            'generation-iv': 'Sinnoh',
            'generation-v': 'Unova',
            'generation-vi': 'Kalos',
            'generation-vii': 'Alola',
            'generation-viii': 'Galar',
            'generation-ix': 'Paldea'
        };
        const region = regionMap[genName] || 'Unknown';
        let evolvedFromId = null;
        if (speciesData.evolves_from_species) {
            const urlParts = speciesData.evolves_from_species.url.split('/');
            const parentId = parseInt(urlParts[urlParts.length - 2]);
            if (parentId <= 151) {
                evolvedFromId = parentId;
            }
        }

        // Find the first English flavor text entry and clean up line breaks
        const englishEntry = pokedexData.flavor_text_entries.find(entry => entry.language.name === 'en');
        const pokedexDescription = englishEntry ? englishEntry.flavor_text.replace(/[\n\f]/g, ' ') : 'No description available.';

        const cryLatest = data.cries?.latest || null;
        const cryLegacy = data.cries?.legacy || null;

        // 2. Insert main Pokémon record
        const pokemonSql = `INSERT INTO pokemons (pokemon_id, pokemon_name, pokemon_img, pokemon_shiny_img, pokemon_height, pokemon_weight, pokemon_hp, pokemon_atk, pokemon_def, pokemon_sp_atk, pokemon_sp_def, pokemon_speed, pokemon_generation, pokemon_region, pokemon_evolved_from_id, pokemon_desc, pokemon_cry_latest, pokemon_cry_legacy) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
                    AS new_data
                    ON DUPLICATE KEY UPDATE 
                    pokemon_name = new_data.pokemon_name,
                    pokemon_shiny_img = new_data.pokemon_shiny_img,
                    pokemon_region = new_data.pokemon_region,
                    pokemon_evolved_from_id = new_data.pokemon_evolved_from_id,
                    pokemon_desc = new_data.pokemon_desc,
                    pokemon_cry_latest = new_data.pokemon_cry_latest,
                    pokemon_cry_legacy = new_data.pokemon_cry_legacy`;

        db.query(pokemonSql, [pokemonId, name, image, shinyImage, height, weight, hp, attack, defense, spAtk, spDef, speed, generation, region, evolvedFromId, pokedexDescription, cryLatest, cryLegacy], async (err) => {
            if (err) {
                console.error(`Error inserting ${name}:`, err.message);
                return;
            }

            // 3. Handle Types
            for (const typeInfo of data.types) {
                const typeName = typeInfo.type.name;
                const typeSql = `INSERT INTO types (type_name) VALUES (?) ON DUPLICATE KEY UPDATE type_id=LAST_INSERT_ID(type_id)`;

                db.query(typeSql, [typeName], (typeErr) => {
                    if (typeErr) return;

                    const getTypeIdSql = `SELECT type_id FROM types WHERE type_name = ?`;
                    db.query(getTypeIdSql, [typeName], (getErr, typeRows) => {
                        if (getErr || typeRows.length === 0) return;

                        const typeId = typeRows[0].type_id;
                        const junctionSql = `INSERT IGNORE INTO pokemon_types (pokemon_id, type_id) VALUES (?, ?)`;
                        db.query(junctionSql, [pokemonId, typeId]); // pokemonId is now securely available here!
                    });
                });
            }

            // 4. Handle Abilities from the API response
            for (const abilityInfo of data.abilities) {
                // Clean up hyphens for nice display names (e.g., 'chlorophyll')
                const rawAbilityName = abilityInfo.ability.name;
                const abilityName = rawAbilityName.replace(/-/g, ' ');
                const isHidden = abilityInfo.is_hidden ? 1 : 0;

                // Insert ability into 'abilities' table if it doesn't already exist
                const abilitySql = `INSERT INTO abilities (ability_name) VALUES (?) ON DUPLICATE KEY UPDATE ability_id=LAST_INSERT_ID(ability_id)`;

                db.query(abilitySql, [abilityName], (abilityErr) => {
                    if (abilityErr) return;

                    // Get the ability_id
                    const getAbilityIdSql = `SELECT ability_id FROM abilities WHERE ability_name = ?`;
                    db.query(getAbilityIdSql, [abilityName], (getErr, abilityRows) => {
                        if (getErr || abilityRows.length === 0) return;

                        const abilityId = abilityRows[0].ability_id;

                        // Insert into the pokemon_abilities junction table
                        const junctionAbilitySql = `INSERT IGNORE INTO pokemon_abilities (pokemon_id, ability_id, is_hidden) VALUES (?, ?, ?)`;
                        db.query(junctionAbilitySql, [pokemonId, abilityId, isHidden], (junctionErr) => {
                            if (junctionErr) {
                                console.error(`Error linking ability to pokemon:`, junctionErr.message);
                            }
                        });
                    });
                });
            }
        });


        console.log(`Successfully seeded ${name}!`);

    } catch (error) {
        console.error(`Failed to fetch Pokémon ID ${id}:`, error.message);
    }

}

// Run a loop sequentially to ensure base forms are inserted before their evolutions
async function runSeeder() {
    for (let i = 1; i <= 151; i++) {
        await seedPokemon(i);
    }
}

runSeeder();