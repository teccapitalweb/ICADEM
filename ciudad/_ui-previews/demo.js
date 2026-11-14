import { createVisualLab } from './views.js';
import { createFixtureController, PETS, PRODUCTS, FLAVORS, GAME_TITLES, GAME_THEMES } from './fixtures.js';
const controller=createFixtureController();
createVisualLab(document.getElementById('preview'),{model:controller.model,catalogs:{pets:PETS,products:PRODUCTS,flavors:FLAVORS,gameTitles:GAME_TITLES,gameThemes:GAME_THEMES},dispatch:action=>controller.dispatch(action)});
