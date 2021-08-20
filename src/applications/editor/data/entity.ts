import { omit, pick } from 'lodash';
import { Feature } from 'geojson';
import config from './../../../config/config';
import { EditorComponentsDefintion, EditorEntitiesDefinition } from './../../../types';

export interface EntityBase {
  entity_id: number;
  entity_type: string;
}

export interface ComponentData {
  component_id?: number;
  component_type: string;
}

/**
 * Entity model
 */
export class EntityModel {
  /**
   * Entity identifier. <code>-1</code> means a new entity.
   */
  entity_id: number = -1 * Date.now();

  /**
   * Type of the entity.
   */
  entity_type: string;

  /**
   * List of components of the entity
   */
  components: Array<ComponentData> = [];

  /**
   * List of modification (ie. operations)
   */
  operations: Array<EditorOperation> = [];

  /**
   * List of component definition for the actual entity
   */
  schema: EditorComponentsDefintion;

  /**
   * Boolean to know if the entity has been mark as deleted
   */
  isDeleted = false;

  /**
   * Default constructor that create a new Entity.
   * Parameter arg can be :
   * - just an entity_type to create an empty entity
   * - an JSON object that comes from the API (id, type, components)
   * - an JSON object that comes from a form (id, type, ...)
   */
  constructor(
    arg: string | EntityBase,
    entitiesDef: EditorEntitiesDefinition,
    componentsDef: EditorComponentsDefintion,
  ) {
    if (typeof arg === 'string') {
      this.entity_type = arg;
      // all component has the same identifier
      this.components.push({ ...config.editor.component_identifier, component_type: 'identifier' });
    } else {
      this.entity_id = arg.entity_id || -1;
      this.entity_type = arg.entity_type;
      this.parseJSON(arg);
    }
    this.schema = pick(componentsDef, entitiesDef[this.entity_type]);
  }

  /**
   * Convert the entity to a flatten JSON object (ie with all component at the root).
   * This JSON is mainly used for the form to edit the data.
   */
  toObject(): EntityBase {
    const result = {
      entity_id: this.entity_id,
      entity_type: this.entity_type,
    };
    this.components.forEach((component: ComponentData) => {
      result[component.component_type] = omit(component, ['component_type']);
    });
    return result;
  }

  /**
   * Convert the entity to a GeoJSON.
   */
  toGeoJSON(): Feature {
    const geoComponent: ComponentData = this.components.find((component: ComponentData) =>
      component.component_type.startsWith('geo_'),
    );
    if (!geoComponent) throw new Error('Entity has no geo component');
    return {
      type: 'Feature',
      // per convention, the geo component start with `geo_`
      geometry: geoComponent.geographic,
      properties: this.toObject(),
    };
  }

  /**
   * Compute the JSON schema for the entity.
   * NB: Geo component & identifier are omitted
   */
  getJsonSchema(): JSONSchema7 {
    const jsonSchema: JSONSchema7 = {
      type: 'object',
      properties: {},
      required: [],
    };
    Object.keys(this.schema)
      .filter((name) => name !== 'identifier' && !name.startsWith('geo_'))
      .forEach((componentType: string) => {
        jsonSchema.properties[componentType] = this.schema[componentType];
        jsonSchema.required.push(componentType);
      });
    return jsonSchema;
  }

  /**
   * Update the entity properties and create the corresponding operations.
   */
  update(json: EntityBase): void {
    this.parseJSON(json);
    if (this.entity_id > 0) {
      // TODO: make a diff
      this.operations = this.components.map((component) => {
        return {
          operation: 'update_component',
          component_id: component.component_id,
          component_type: component.component_type,
          update: omit(component, ['component_id', 'component_type']),
        };
      });
    }
  }

  /**
   * Set the geometry of the component.
   * It creates it if none is present, otherwise it's an update.
   * TODO: Generate the operation if needed
   */
  setGeometry(geographic: unknown, schematic?: unknown): void {
    //search the def of the geo
    const geoComponentTypeName: string = Object.keys(this.schema).find((componentType: string) =>
      componentType.startsWith('geo_'),
    );
    if (!geoComponentTypeName) throw new Error('Entity has no geo component definition');

    // Search the geo component
    const geoComponent: ComponentData = this.components.find(
      (component: ComponentData) => component.component_type === geoComponentTypeName,
    );
    if (geoComponent) {
      geoComponent.geographic = geographic;
      geoComponent.schematic = schematic ? schematic : geographic;
      this.components = this.components.filter(
        (component: ComponentData) => component.component_type === geoComponentTypeName,
      );
      this.components.push(geoComponent);
    } else {
      this.components.push({
        component_type: geoComponentTypeName,
        geographic: geographic,
        schematic: schematic ? schematic : geographic,
      });
    }
  }

  /**
   * Mark the entity has deleted.
   */
  delete(): void {
    this.isDeleted = true;
  }

  /**
   * Get the list of operations that can be send to the API.
   * IMPORTANT: for create entity we add the entity_id field which is not valid
   * for the API, but usefull to update the data with the response.
   */
  getOperations(): Array<EditorOperation> {
    let operations: Array<EditorOperation> = [];
    if (this.isDeleted) {
      operations.push({ operation: 'delete_entity', entity_id: this.entity_id });
    } else {
      if (this.entity_id < 0) {
        operations.push({
          operation: 'create_entity',
          entity_type: this.entity_type,
          entity_id: this.entity_id,
          components: this.components
            .filter(
              (component) =>
                Object.keys(omit(component, ['component_type', 'component_id'])).length > 0,
            )
            .map((component) => {
              return {
                component_type: component.component_type,
                component: omit(component, ['component_type', 'component_id']),
              };
            }),
        });
      } else {
        operations = this.operations;
      }
    }
    return operations;
  }

  /**
   * Parse a JSON and update the entity properties.
   */
  private parseJSON(arg: any): void {
    const componentsData = arg.components
      ? arg.components
      : omit(arg, ['entity_id', 'entity_type']);
    this.components = Object.keys(componentsData).map((type: string) => {
      return { ...componentsData[type], component_type: type };
    });
  }
}
