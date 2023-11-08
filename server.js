const express = require('express');
const app = express();
const port = 3000; // or any port you prefer


app.get('/', (req, res) => {
    res.send('Welcome to Ruta-Backend Server');
  });
  
