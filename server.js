const express = require('express');
const bodyparser = require('body-parser'); 
const app = express();
const port = 3000; // or any port you prefer

app.use(bodyparser.json());

app.get('/', (req, res) => {
    res.send('Welcome to Ruta-Backend Server');
  });

app.post('/book', (req, res) => {
    const {origin, destination} = req.body;
    console.log("Origin:", origin);
    console.log("Destination:", destination);
});

app.listen(port, ()=> {
  console.log("Server is running on port: ".port);
})


