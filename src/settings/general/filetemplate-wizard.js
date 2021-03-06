import { inject, BindingEngine } from 'aurelia-framework';
import { ValidationRules } from 'aurelia-validation';
import { DialogController } from 'aurelia-dialog';
import { WorkflowApi } from '../../workflows/api';

@inject(Element, DialogController, BindingEngine, WorkflowApi)
export class FiletemplateWizard {

    constructor(element, dialogController, bindingEngine, workflowApi) {
        this.dialog = dialogController;
        this.be = bindingEngine;
        this.api = workflowApi;

        this.task = undefined;
        this.mapFields = [];

        this.item = {
            fields: [],
        }

        this.taskFields = [
            'product_identifier',
            'inventory_identifier',
            'product_input_amount',
            'product_input_measure',
        ];

        this.inventoryFields = [
            'name',
            'identifier',
            'barcode',
            'description',
            'item_type',
            'amount_available',
            'amount_measure',
            'concentration',
            'concentration_measure',
            'location',
        ];

        this.requiredForInventoryInput = [
            'name',
            'item_type',
            'amount_available',
            'amount_measure',
            'location',
        ];

        this.requiredForTaskInput = [
            'product_identifier',
            'inventory_identifier',
            'product_input_amount',
            'product_input_measure',
        ];

        this.observeUsedFor = (n, o) => {
            // Add required fields to the list!
            this.item.fields.splice(0, this.item.fields.length);
            if (this.item.file_for == 'input') {
                if (n == 'task') {
                    for (let r of this.requiredForTaskInput) {
                        this.item.fields.push({name: r, map_to: r, required: true});
                    }
                } else if (n == 'inventory') {
                    this.mapFields = this.inventoryFields.slice();
                    for (let r of this.requiredForInventoryInput) {
                        this.item.fields.push({name: r, map_to: r, required: true});
                    }
                }
            }
        }

        this.observeTask = (n, o) => {
            let availableFields = this.taskFields.slice();
            let fieldList = ['input_fields', 'output_fields', 'variable_fields'];
            this.api.taskDetail(n).then(data => {
                for (let fieldName of fieldList) {
                    for (let field of data[fieldName]) {
                        availableFields.push(field.label);
                    }
                }
                this.mapFields = availableFields;
            });
        }
    }

    addField() {
        this.item.fields.push({});
    }

    removeField(index) {
        this.item.fields.splice(index, 1);
    }

    activate(model) {
        this.item = model;
        this.task = undefined;
        this.used_for = undefined;
        this.usedForObserver = this.be.propertyObserver(this, 'used_for')
                                      .subscribe(this.observeUsedFor);
        this.taskObserver = this.be.propertyObserver(this, 'task').subscribe(this.observeTask);
        console.log('I have been activated!', model);
    }

    deactivate() {
        console.log('bye bye');
        this.usedForObserver.dispose();
        this.taskObserver.dispose();
    }
}
