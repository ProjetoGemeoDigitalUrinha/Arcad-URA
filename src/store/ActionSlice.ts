/* eslint-disable @typescript-eslint/no-explicit-any */
import { Action } from "./Action";
import { ActionLabels } from "./ActionsLabels";

export const createActionSlice = (set, get) => ({
  actions: {} as Record<string, Action[]>,

  addAction: (action: Action, overwrite = true) => {
    set((state) => {
      const current = state.actions[action.target] ?? [];

      let updated;
      if (overwrite) {
        updated = current.filter((a) => a.trigger !== action.trigger);
        updated.push(action);
      } else {
        updated = [...current, action];
      }

      state.actions[action.target] = updated;
    });
  },

  getActions: (key: string) => get().actions[key],

  triggerAction: (trigger, targetName, event) => {
    const selectedActions = get().actions[targetName]?.filter(
      (a) => a.targetNode === undefined && a.trigger === trigger
    );

    selectedActions?.forEach((a) => a.cb(event));
  },
});

export interface ActionSlice {
  actions: Record<string, Action[]>;
  addAction: (action: Action) => void;
  getActions: (key: string) => Action[] | undefined;
  triggerAction: (
    trigger: ActionLabels | any,
    targetName: string,
    event?: Event | any
  ) => void;
}
