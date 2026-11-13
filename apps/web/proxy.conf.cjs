// Permite elegir la API de la demo sin cambiar el puerto habitual de desarrollo.
module.exports = {
  '/api/**': { target: process.env.API_PROXY_TARGET || 'http://localhost:3000' },
};