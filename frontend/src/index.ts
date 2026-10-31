import "./blocks/index.ts";
import { TdmmProgressCard } from "./cards/progress/tdmm-progress-card.ts";
import { defineOnce, registerCard } from "./register.ts";
import { TdmmBlockList } from "./editor/tdmm-block-list.ts";

defineOnce("tdmm-block-list", TdmmBlockList);
defineOnce("tdmm-progress-card", TdmmProgressCard);
registerCard({
  type: "custom:tdmm-progress-card",
  name: "3DMM Progress",
  description: "Compact print progress for a 3D Model Manager printer.",
  preview: true,
});
