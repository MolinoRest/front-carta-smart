import { Dish } from "./dish";

export interface Menu {
  name: string;
  dishes?: Dish[];
}