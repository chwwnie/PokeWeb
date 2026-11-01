# PokeWeb

A Pokédex website covering Generations 1–9 (Pokémon #1–1025), built with Node.js, Express, EJS and MySQL. Pokémon data and images come from [PokéAPI](https://pokeapi.co/).

## Features

- **Pokédex**: search, filter by generation and type, A–Z sort, swipe paging on mobile
- **Alternate forms**: regional, Mega and Gigantamax forms with their own artwork, stats, types and cries
- **Shiny toggle** and cries on every Pokémon page
- **Pokédex Quiz**: name as many Pokémon as you can, with optional timer, silhouettes and generation/type filters

> This project runs on your own computer. There is no hosted version currently.

## How to run it

| | Docker (easiest) | Without Docker |
|---|---|---|
| Install | Docker Desktop | Node.js (LTS), MySQL 8, Git |
| Database setup | Automatic | You import one file |

## Option A: Run with Docker

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and start it. Wait until it says it is running.
2. Download this repository (green **Code** button → **Download ZIP**, then unzip) or clone it:
   ```
   git clone https://github.com/chwwnie/PokeWeb
   cd <folder name>
   ```
3. Make sure `database/pokedex.sql` is in the project folder.
4. Open a terminal **in the project folder** (the one containing `docker-compose.yml`) and run:
   ```
   docker compose up --build
   ```
   The first start takes a few minutes because the database is created and filled.
5. Open **http://localhost:3000/pokedex**.

To stop: press `Ctrl + C`.
To start again later: `docker compose up`.
To wipe the database and re-import from scratch: `docker compose down -v`, then `docker compose up --build`.

## Option B: Run without Docker

1. Install [Node.js](https://nodejs.org/) (LTS), [MySQL 8](https://dev.mysql.com/downloads/mysql/) and [Git](https://git-scm.com/).
2. Clone the repository and install the packages:
   ```
   git clone https://github.com/chwwnie/PokeWeb
   cd <folder name>
   npm install
   ```
3. Create the database and import the Pokémon data. Replace `pokedex` with your database name if you use a different one:
   ```
   mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS pokedex"
   mysql -u root -p pokedex < database/pokedex.sql
   ```
   (Windows PowerShell does not support `<`. Use Command Prompt, or run `Get-Content database/pokedex.sql | mysql -u root -p pokedex`.)
4. Copy `.env.example` to `.env` and fill in your details:
   ```
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD= *your own password*
   DB_NAME=pokedex
   SESSION_SECRET=any_long_random_text
   PORT=3000
   ```
5. Start the site:
   ```
   node app.js
   ```
6. Open **http://localhost:3000/pokedex**.

## Troubleshooting

| Problem | Fix |
|---|---|
| `docker` is not recognised | Install Docker Desktop, then open a **new** terminal window |
| `Access denied for user` | The password in `.env` doesn't match MySQL. With Docker, run `docker compose down -v` and start again |
| `ECONNREFUSED` on port 3306 | The database is still starting. Wait a minute, or restart with `docker compose up` |
| `Cannot GET /` | Go to `/pokedex` |
| Port 3000 already in use | Change `PORT` in `.env` (and the port mapping in `docker-compose.yml`) |
| Import fails with `GTID_PURGED` or `SQL_LOG_BIN` | Delete those lines from the `.sql` file and import again |
| Moves or sprites missing on the Team Builder | That page loads move data from PokéAPI, so it needs an internet connection |

## Project notes

- `seed.js` refills the database from PokéAPI (`node seed.js`, or `node seed.js pokemon_id_no` for one Pokémon). It takes a long time and isn't needed if you import `database/pokedex.sql`.
- All settings come from environment variables. See `.env.example`.
- Never commit your real `.env` file. It is listed in `.gitignore`.
- Saved teams are stored in your browser (localStorage), not in the database.

## Credits

Pokémon data and images come from [PokéAPI](https://pokeapi.co/). Pokémon and all related names and artwork are trademarks of Nintendo, Game Freak and The Pokémon Company. This is a fan project and is not affiliated with them.
