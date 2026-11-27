/* -------------------------------------------------------------
   SHOOTING STARS - Main Entry Point
   Boots the authenticated application shell.
   The game engine is not started until the user signs in.
   ------------------------------------------------------------- */

import { bootApp } from './app.js';

window.addEventListener('DOMContentLoaded', () => {
    bootApp();
});
