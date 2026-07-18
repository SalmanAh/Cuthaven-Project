import Taxjar from "taxjar";
import { env } from "./env.js";

// Single shared TaxJar client instance.
// If TAXJAR_API_KEY is absent (dev without TaxJar configured), the client
// is initialised with a placeholder — calculateTax() handles the fallback.
export const taxjar = env.TAXJAR_API_KEY
  ? new Taxjar({ apiKey: env.TAXJAR_API_KEY })
  : null;
