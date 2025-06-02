import app from './app.js';
import sequelize from './config/database.js';

const PORT = process.env.PORT || 3000;

sequelize.sync({ force: false }).then(() => {
  app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
}).catch((error) => console.error('Unable to connect to the database:', error));