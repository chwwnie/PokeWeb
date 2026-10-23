const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const app = express();
const router = express.Router();
const port = 3000;

// Create a connection to the database
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'RP738964$',
  database: 'angelina_pokemonweb'
});

db.connect((err) => {
  if (err) {
    throw err;
  }
  console.log('Connected to database');
});

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static('public'));

app.use(session({
  secret: 'secret',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 180 }
}));

app.use(flash());

app.set('view engine', 'ejs');

// Pokedex route with search, filters, alphabetical order, and pagination
app.get('/pokedex', (req, res) => {
  const searchPokemon = req.query.search;
  const typeFilter = req.query.types;
  const generationFilter = req.query.generations;

  // Direction (⇅ button): 'asc' or 'desc'. Older links that used 'name_asc' / 'name_desc' still work.
  const sortBy = req.query.sort || 'asc';
  const sortDirection = String(sortBy).endsWith('desc') ? 'DESC' : 'ASC';

  // Alphabetical filter: ticked checkbox sends sortby=name; otherwise order by Pokédex number
  const alphabetical = req.query.sortby === 'name' || String(sortBy).startsWith('name_');

  const limit = 12;
  const page = parseInt(req.query.page) || 1;
  const offset = (page - 1) * limit;

  let baseSql = `FROM pokemons p
    LEFT JOIN pokemon_types pt ON p.pokemon_id = pt.pokemon_id
    LEFT JOIN types t ON pt.type_id = t.type_id
    WHERE 1=1`;

  let params = [];

  if (searchPokemon) {
    baseSql += ` AND p.pokemon_name LIKE ?`;
    params.push(`${searchPokemon}%`);
  }

  if (generationFilter) {
    const gensArray = Array.isArray(generationFilter) ? generationFilter : [generationFilter];
    const placeholders = gensArray.map(() => '?').join(',');
    baseSql += ` AND p.pokemon_generation IN (${placeholders})`;
    params.push(...gensArray);
  }

  if (typeFilter) {
    const typesArray = Array.isArray(typeFilter) ? typeFilter : [typeFilter];
    const placeholders = typesArray.map(() => '?').join(',');
    baseSql += ` AND t.type_name IN (${placeholders})`;
    params.push(...typesArray);
  }

  const countSql = `SELECT COUNT(DISTINCT p.pokemon_id) AS total ${baseSql}`;

  db.query(countSql, params, (err, countResult) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: err.message });
    }

    const totalPokemons = countResult[0].total;
    const totalPages = Math.ceil(totalPokemons / limit);

    let dataSql = `SELECT
        p.pokemon_id AS id,
        p.pokemon_img AS image,
        p.pokemon_name AS name,
        GROUP_CONCAT(t.type_name SEPARATOR ', ') AS type,
        p.pokemon_hp AS hp,
        p.pokemon_height AS height,
        p.pokemon_weight AS weight,
        p.pokemon_generation AS generation,
        p.pokemon_desc AS description
      ${baseSql}
      GROUP BY p.pokemon_id`;

    // sortDirection is only ever 'ASC' or 'DESC' (never raw user input), so it is safe to put in the SQL
    if (alphabetical) {
      dataSql += ` ORDER BY p.pokemon_name ${sortDirection}, p.pokemon_id ASC`;
    } else {
      dataSql += ` ORDER BY p.pokemon_id ${sortDirection}`;
    }

    dataSql += ` LIMIT ${limit} OFFSET ${offset}`;

    db.query(dataSql, params, (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
      }

      res.render('pokedex', {
        pokemons: rows,
        searchPokemon: searchPokemon || '',
        selectedTypes: typeFilter ? (Array.isArray(typeFilter) ? typeFilter : [typeFilter]) : [],
        selectedGens: generationFilter ? (Array.isArray(generationFilter) ? generationFilter : [generationFilter]) : [],
        currentSortQuery: sortBy,                        // direction value, as before
        currentSortBy: alphabetical ? 'name' : 'id',     // used by the Alphabetical checkbox
        currentPage: page,
        totalPages: totalPages,
        queryParams: req.query
      });
    });
  });
});

router.get('/pokemon/:id', (req, res) => {
    const pokemonId = req.params.id;
    const limit = 12; // Match the number of items you display per page in your Pokedex list

    // Query to find the Pokémon's index position relative to all ordered Pokémon
    const positionQuery = `
        SELECT COUNT(*) as row_num
        FROM pokemons
        WHERE pokemon_id <= ?
    `;

    db.query(positionQuery, [pokemonId], (err, results) => {
        let returnPage = 1;
        if (!err && results.length > 0) {
            const rowIndex = results[0].row_num;
            returnPage = Math.ceil(rowIndex / limit);
        }

        // Fetch your normal Pokémon details...
        db.query(`SELECT * FROM pokemons WHERE pokemon_id = ?`, [pokemonId], (err, pokemonRows) => {
            res.render('pokemon-detail', {
                pokemon: pokemonRows[0],
                returnPage: returnPage // Pass the calculated page back to EJS
            });
        });
    });
});

// Single Pokémon Detail Route (Merged & Corrected with Types, Abilities, Evolutions, and Forms)
app.get('/pokemon/:id', (req, res) => {
  const pokemonId = req.params.id;

  const query = `
      SELECT p.*,
              GROUP_CONCAT(DISTINCT t.type_name SEPARATOR ', ') AS type,
              GROUP_CONCAT(DISTINCT CONCAT(a.ability_name, IF(pa.is_hidden = 1, ' (Hidden)', '')) SEPARATOR ', ') AS pokemon_abilities,
              MAX(evo.pokemon_id) AS evolved_from_id,
              MAX(evo.pokemon_name) AS evolved_from_name,
              MAX(evo.pokemon_img) AS evolved_from_img,
              GROUP_CONCAT(DISTINCT next_evo.pokemon_id ORDER BY next_evo.pokemon_id) AS evolves_to_ids,
              GROUP_CONCAT(DISTINCT next_evo.pokemon_name ORDER BY next_evo.pokemon_id) AS evolves_to_names,
              GROUP_CONCAT(DISTINCT next_evo.pokemon_img ORDER BY next_evo.pokemon_id) AS evolves_to_imgs,
              COALESCE(
                  (SELECT MAX(pokemon_id) FROM pokemons WHERE pokemon_id < p.pokemon_id),
                  (SELECT MAX(pokemon_id) FROM pokemons)
              ) AS prev_id,
              COALESCE(
                  (SELECT MIN(pokemon_id) FROM pokemons WHERE pokemon_id > p.pokemon_id),
                  (SELECT MIN(pokemon_id) FROM pokemons)
              ) AS next_id
      FROM pokemons p
      LEFT JOIN pokemon_types pt ON p.pokemon_id = pt.pokemon_id
      LEFT JOIN types t ON pt.type_id = t.type_id
      LEFT JOIN pokemon_abilities pa ON p.pokemon_id = pa.pokemon_id
      LEFT JOIN abilities a ON pa.ability_id = a.ability_id
      LEFT JOIN pokemons evo ON p.pokemon_evolved_from_id = evo.pokemon_id
      LEFT JOIN pokemons next_evo ON next_evo.pokemon_evolved_from_id = p.pokemon_id
      WHERE p.pokemon_id = ?
      GROUP BY p.pokemon_id
  `;

  db.query(query, [pokemonId], (err, pokemonRows) => {
    if (err || pokemonRows.length === 0) {
      console.error(err);
      return res.status(404).send('Pokémon not found');
    }

    db.query(`SELECT * FROM pokemon_forms WHERE pokemon_id = ? ORDER BY form_name`, [pokemonId], (err, formRows) => {
      if (err) {
        console.error('Failed to load Pokémon forms:', err);
        return res.status(500).send('Unable to load Pokémon forms');
      }

      res.render('pokemon', {
        pokemon: pokemonRows[0],
        forms: formRows
      });
    });
  });
});

app.get('/pokemonQuiz', (req, res) => {
  res.render('pokemonQuiz');
});

app.post('/pokemonQuiz', (req, res) => {
  res.render('pokemonQuiz');
});

app.listen(3000, () => {
  console.log(`Server is running on port http://localhost:3000/pokedex`);
});