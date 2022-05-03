import { omit, pick } from 'lodash';
import { Feature, Geometry } from 'geojson';
import { JSONSchema7 } from 'json-schema';

import config from '../../../config/config';
import {
  EditorComponentsDefinition,
  EditorEntitiesDefinition,
  EditorOperation,
} from '../../../types';

export interface EntityBase {
  entity_id: number;
  entity_type: string;
}

export interface ComponentBase {
  component_id?: number;
  component_type: string;
}
export interface GeoComponent extends ComponentBase {
  geographic: Geometry;
  schematic: Geometry;
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
  components: Array<ComponentBase> = [];

  /**
   * List of modification (ie. operations)
   */
  operations: Array<EditorOperation> = [];

  /**
   * List of component definition for the actual entity
   */
  schema: EditorComponentsDefinition;

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
    componentsDef: EditorComponentsDefinition
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
  toObject() {
    const result: Record<string, number | string | Omit<ComponentBase, 'component_type'>> = {
      entity_id: this.entity_id,
      entity_type: this.entity_type,
    };
    this.components.forEach((component: ComponentBase) => {
      result[component.component_type] = omit(component, ['component_type']);
    });

    return result;
  }

  /**
   * Convert the entity to a GeoJSON.
   */
  toGeoJSON(): Feature {
    const geoComponent = this.components.find((component: ComponentBase) =>
      component.component_type.startsWith('geo_')
    );
    if (!geoComponent) throw new Error('Entity has no geo component');

    return {
      id: this.entity_id,
      type: 'Feature',
      // per convention, the geo component start with `geo_`
      geometry: (geoComponent as GeoComponent).geographic,
      properties: this.toObject(),
    };
  }

  /**
   * Compute the JSON schema for the entity.
   * NB: Geo component & identifier are omitted
   */
  getJsonSchema(): JSONSchema7 {
    const properties: NonNullable<JSONSchema7['properties']> = {};
    const required: NonNullable<JSONSchema7['required']> = [];

    Object.keys(this.schema)
      .filter((name) => name !== 'identifier' && !name.startsWith('geo_'))
      .forEach((componentType: string) => {
        properties[componentType] = this.schema[componentType];
        required.push(componentType);
      });

    return {
      type: 'object',
      properties,
      required,
    };
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
        } as EditorOperation;
      });
    }
  }

  /**
   * Set the geometry of the component.
   * It creates it if none is present, otherwise it's an update.
   * TODO: Generate the operation if needed
   */
  setGeometry(geographic: Geometry, schematic?: Geometry): void {
    // search the def of the geo
    const geoComponentTypeName = Object.keys(this.schema).find((componentType: string) =>
      componentType.startsWith('geo_')
    );
    if (!geoComponentTypeName) throw new Error('Entity has no geo component definition');

    // Search the geo component
    const geoComponent = this.components.find(
      (component: ComponentBase) => component.component_type === geoComponentTypeName
    ) as GeoComponent | undefined;
    if (geoComponent) {
      geoComponent.geographic = geographic;
      geoComponent.schematic = schematic || geographic;
      this.components = this.components.filter(
        (component: ComponentBase) => component.component_type === geoComponentTypeName
      );
      this.components.push(geoComponent);
    } else {
      this.components.push({
        component_type: geoComponentTypeName,
        geographic,
        schematic: schematic || geographic,
      } as GeoComponent);
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
    } else if (this.entity_id < 0) {
      operations.push({
        operation: 'create_entity',
        entity_type: this.entity_type,
        // [jacomyal]
        // I removed this because it's not in the typedef (but it might be useful)
        // entity_id: this.entity_id,
        components: this.components
          .filter(
            (component) =>
              Object.keys(omit(component, ['component_type', 'component_id'])).length > 0
          )
          .map((component) => {
            return {
              component_type: component.component_type,
              component: omit(component, ['component_type', 'component_id']),
            };
          }),
      });
    } else {
      operations = this.operations.filter(
        (operation) => typeof operation.component_id === 'number'
      );
    }
    return operations;
  }

  /**
   * Parse a JSON and update the entity properties.
   *
   * TODO:
   * Improve typing
   */
  private parseJSON(entity: any): void {
    const componentsData = entity.components
      ? entity.components
      : omit(entity, ['entity_id', 'entity_type']);
    this.components = Object.keys(componentsData).map((type: string) => {
      // TODO: CHeck why we've got sometime an array.
      // Does an entity can have multiple components of same type ??
      return Array.isArray(componentsData[type])
        ? {
            ...componentsData[type][0],
            component_type: type,
          }
        : { ...componentsData[type], component_type: type };
    });
  }
}
