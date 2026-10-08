const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const app = express();
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
app.use(express.json()); // Added to parse JSON bodies if your frontend sends them
app.use(express.static('public'));

app.use(session({
  secret: 'secret',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 180 } // 6 months
}));

app.use(flash());

app.set('view engine', 'ejs');

// View pokemon
// View pokemon webpage
// View pokemon webpage with optional generation filter
app.get('/pokedex', (req, res) => {
  const searchPokemon = req.query.search;
  const typeFilter = req.query.types; // Supports array or single value from checkboxes
  const generationFilter = req.query.generations; // Supports array or single value
  const sortBy = req.query.sort || 'asc';

  // Pagination variables
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

  // 1. Get total count for pagination
  const countSql = `SELECT COUNT(DISTINCT p.pokemon_id) AS total ${baseSql}`;

  db.query(countSql, params, (err, countResult) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: err.message });
    }

    const totalPokemons = countResult[0].total;
    const totalPages = Math.ceil(totalPokemons / limit);

    // 2. Fetch paginated data using the exact same baseSql and filters
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

    if (sortBy === 'desc') {
      dataSql += ` ORDER BY p.pokemon_id DESC`;
    } else {
      dataSql += ` ORDER BY p.pokemon_id ASC`;
    }

    // Safely interpolate LIMIT and OFFSET integers
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
        currentSortQuery: sortBy,
        currentPage: page,
        totalPages: totalPages,
        queryParams: req.query
      });
    });
  });
});

// close-up on pokemon
// Route to view single Pokémon details
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

  db.query(query, [pokemonId], (err, results) => {
    if (err || results.length === 0) {
      console.error(err);
      return res.status(404).send('Pokémon not found');
    }
    res.render('pokemon', { pokemon: results[0] });
  });
});
app.listen(3000, () => {
  console.log(`Server is running on port http://localhost:3000/pokedex`);
});