import { zecs } from 'zecs';
import { z } from 'zod/v4';
import { position } from './010-component';
import { ecs } from './030-ecs';

// pixi.js stubs
declare class Asset {}
declare const Assets: { load(src: string): Promise<Asset> };
declare class Sprite {
  position: { x: number; y: number };
  constructor(p: { texture: Asset; position: { x: number; y: number } });
  destroy(): void;
}

const drawSprites = zecs.system({
  name: 'drawSprites',
  query: zecs.query().has(position),

  initParams: z.object({
    texturePath: z.string(),
  }),

  shared: {
    async create({ initParams: { texturePath } }) {
      const texture = await Assets.load(texturePath);
      return { texture };
    },
  },

  each: {
    create({ shared: { texture }, entity }) {
      const sprite = new Sprite({
        texture,
        position: { x: entity.position.x, y: entity.position.y },
      });
      return { sprite };
    },
    destroy({ each: { sprite } }) {
      sprite.destroy();
    },
  },

  onUpdated({ each: { sprite }, entity }) {
    sprite.position.x = entity.position.x;
    sprite.position.y = entity.position.y;
  },
});

const drawSpritesHandle = await zecs.attachSystem(ecs, drawSprites, {
  texturePath: './texture.png',
});

drawSpritesHandle.update({});
