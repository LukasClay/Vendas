import "dotenv/config";
import { startConfiguredServer } from "./startup";

// Falhas de configuracao ou importacao sao fatais durante o bootstrap.
void startConfiguredServer(process.env.MASTER_PASSWORD_HASH);
