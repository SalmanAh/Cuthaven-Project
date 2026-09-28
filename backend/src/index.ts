import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { startCheckoutOutboxWorker } from "./services/checkoutFinalization.service.js";
import { startReservationReconciliationWorker } from "./services/reservationReconciliation.service.js";

const app = createApp();
startCheckoutOutboxWorker();
startReservationReconciliationWorker();

app.listen(env.PORT, () => {
  console.log(`✅ CutHaven backend running on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
});
