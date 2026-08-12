import express, { type ErrorRequestHandler } from "express";
import { ordersRouter } from "./routes/orders.route";
import sessionsRouter from "./routes/sessions.route";
import { usersRouter } from "./routes/users.route";

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(express.json());
app.use("/api/users", usersRouter);
app.use("/api/orders", ordersRouter);
app.use("/api", sessionsRouter);

app.get("/health", (_request, response) => {
  response.status(200).json({ status: "ok" });
});

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error("Unhandled request error", error);
  response.status(500).json({ error: "internal_server_error" });
};

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Golden fixture listening on port ${port}`);
});
