import "./blocks/index.ts";
import { TdmmProgressCard } from "./cards/progress/tdmm-progress-card.ts";
import { TdmmPrinterCard } from "./cards/printer/tdmm-printer-card.ts";
import { TdmmAmsCard } from "./cards/ams/tdmm-ams-card.ts";
import { TdmmCameraCard } from "./cards/camera/tdmm-camera-card.ts";
import { TDMM_VERSION, defineOnce, registerCard } from "./register.ts";
import { TdmmCardEditor } from "./editor/tdmm-card-editor.ts";
import { TdmmBlockList } from "./editor/tdmm-block-list.ts";

(window as unknown as { tdmmCardsVersion?: string }).tdmmCardsVersion = TDMM_VERSION;
console.info(`%c TDMM cards %c v${__TDMM_VERSION__}`, "color:#fff;background:#03a9f4;font-weight:700", "color:#03a9f4;font-weight:700");

defineOnce("tdmm-block-list", TdmmBlockList);
defineOnce("tdmm-card-editor", TdmmCardEditor);
defineOnce("tdmm-progress-card", TdmmProgressCard);
defineOnce("tdmm-printer-card", TdmmPrinterCard);
defineOnce("tdmm-ams-card", TdmmAmsCard);
defineOnce("tdmm-camera-card", TdmmCameraCard);
registerCard({
  type: "custom:tdmm-progress-card",
  name: "3DMM Progress",
  description: "Compact print progress for a 3D Model Manager printer.",
  preview: true,
});
registerCard({
  type: "custom:tdmm-printer-card",
  name: "3DMM Printer",
  description: "Status, controls and filament for a 3D Model Manager printer",
  preview: true,
});
registerCard({
  type: "custom:tdmm-ams-card",
  name: "3DMM AMS",
  description: "Loaded filament and AMS status",
});
registerCard({
  type: "custom:tdmm-camera-card",
  name: "3DMM Camera",
  description: "Printer camera with print progress overlay",
});
