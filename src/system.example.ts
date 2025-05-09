const tileSystem = system({
  params: z.object({
    displayContainer: z.custom<Container>(),
    viewContainer: z.custom<Container>(),
    renderer: z.custom<Renderer>(),
  }),
  shared: {
    create: ({ params }) => {
      const quad = new Mesh();
      params.displayContainer.addChild(quad);

      const blobContainer = new Container();

      return { quad, blobContainer };
    },
    destroy: ({ params, shared }) => {
      params.displayContainer.removeChild(shared.quad);
    },
  },
  derived: {
    create: ({ shared, entity }) => {
      const sprite = new Sprite({
        position: {
          x: entity.x * entity.tileSize,
          y: entity.y * entity.tileSize,
        },
      });
      shared.blobContainer.addChild(sprite);

      return { sprite };
    },
    destroy: ({ shared, derived }) => {
      shared.blobContainer.removeChild(derived.sprite);
    },
  },
  postUpdate({ params }) {
    params.renderer.render({
      container: params.blobContainer,
      target: params.densityTexture,
      transform: params.viewContainer.worldTransform,
    });
  },
});
