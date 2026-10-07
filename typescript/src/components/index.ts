import { register, type AnyComponent } from "../machine.js";
import { accordion } from "./accordion.js";
import { combobox } from "./combobox.js";
import { dialog } from "./dialog.js";
import { disclosure } from "./disclosure.js";
import { listbox } from "./listbox.js";
import { menu } from "./menu.js";
import { radiogroup } from "./radiogroup.js";
import { slider } from "./slider.js";
import { tabs } from "./tabs.js";
import { toast } from "./toast.js";
import { checkbox, switchComponent } from "./toggle.js";
import { tooltip } from "./tooltip.js";

export const COMPONENTS: AnyComponent[] = [accordion, checkbox, combobox, dialog, disclosure, listbox, menu, radiogroup, slider, switchComponent, tabs, toast, tooltip];
for (const c of COMPONENTS) register(c);

export { accordion, checkbox, combobox, dialog, disclosure, listbox, menu, radiogroup, slider, switchComponent, tabs, toast, tooltip };
