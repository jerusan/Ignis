import IgnisApp from './index';
import type { ComponentPreviewModule } from '../previewTypes';

const previews: ComponentPreviewModule = {
  componentName: 'IgnisApp',
  importPath: 'components/IgnisApp',
  previews: [
    {
      name: 'Technician workspace',
      description: 'Production chat shell backed by the Ignis API stream.',
      render: () => (
        <div className="h-[760px] overflow-hidden border border-background-subtle">
          <IgnisApp />
        </div>
      )
    }
  ]
};

export default previews;
