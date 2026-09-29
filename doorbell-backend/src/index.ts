import app from "./app.js";

const PORT = 8001;

app.listen(PORT, (error) => {
  if (error) {
    console.error("Error starting the server", error);
  } else {
    console.log(`Server is running on port ${PORT}`);
  }
});
