# PokeWeb

A Pokédex website covering Generations 1–9 (Pokémon #1–1025) with alternate forms, shiny sprites, filters, a Pokédex quiz and more. Built with Node.js, Express, EJS and MySQL, with data from [PokéAPI](https://pokeapi.co/).

This project can currently only run on your own computer. The quickest way is Docker, which sets up the website and its database for you.

## Run it on your own computer

### Option A: Docker (easiest)

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/).
2. Download or clone this repository.
3. In the project folder, run:
   ```
   docker compose up --build
   ```
4. Open http://localhost:3000. The database is created and filled automatically the first time.

To stop it, press `Ctrl + C`. To start fresh with a new database, run `docker compose down -v` first.

### Option B: Without Docker

1. Install [Node.js](https://nodejs.org/) (LTS), [MySQL](https://dev.mysql.com/downloads/mysql/) and [Git](https://git-scm.com/).
2. Clone the repository and install packages:
   ```
   git clone <this repository's URL>
   cd <folder name>
   npm install
   ```
3. Import the database (creates every table and loads all the Pokémon):
   ```
   mysql -u root -p < database/pokedex.sql
   ```
4. Copy `.env.example` to `.env` and fill in your MySQL password.
5. Start the site:
   ```
   node app.js
   ```
   (If you use a `.env` file, `app.js` must load it. See the notes below.)
6. Open http://localhost:3000.

## Project notes

- `seed.js` refills the database from PokéAPI (`node seed.js`, or `node seed.js 713` for one Pokémon). It takes a while and isn't needed if you import `database/pokedex.sql`.
- Settings come from environment variables: see `.env.example`.

## Credits

Pokémon data and images come from [PokéAPI](https://pokeapi.co/). Pokémon and all related names and artwork are trademarks of Nintendo, Game Freak and The Pokémon Company. This is a fan project and is not affiliated with them.
