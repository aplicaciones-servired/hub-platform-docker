import serviredLogo from "@/assets/servired-logo.png";
import multiredLogo from "@/assets/multired-logo.png";

export const COMPANY =
  process.env.NEXT_PUBLIC_COMPANY === "MULTIRED" ? "MULTIRED" : "SERVIRED";

export const COMPANY_NAME = COMPANY === "MULTIRED" ? "MultiRed" : "ServiRed";

export const COMPANY_LOGO = COMPANY === "MULTIRED" ? multiredLogo : serviredLogo;
