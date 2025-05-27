import { ecs } from './030-ecs';

declare function mySave(data: string): void;
declare function myLoad(): string;

const data = ecs.toJSON();

// your serializing and saving logic
mySave(JSON.stringify(data));
const loaded = JSON.parse(myLoad());

ecs.loadJSON(loaded);
