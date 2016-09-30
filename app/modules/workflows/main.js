'use strict';

var app = angular.module('limsFrontend');

app.controller('WorkflowsCtrl', function($scope, PageTitle,
    $mdDialog, RunService, $rootScope, $state) {

    PageTitle.set('Workflows');
    $scope.removePadding = true;

    var getActiveRuns = function() {
        RunService.runs({is_active: 'True'}).then(function(data) {

            $scope.activeRuns = data;

            if (data.length > 0) {
                if (!$state.params.id) {
                    $state.go('app.workflows.run',
                              {id: data[0].id},
                              {location: 'replace'});
                    $state.selectedRun = data[0].id;
                } else {
                    $state.go('app.workflows.run',
                              {id: $state.params.id},
                              {location: 'replace'});
                    $state.selectedRun = $state.params.id;
                }
            }
        });

        RunService.runs({is_active: 'False', }).then(function(data) {
            $scope.finishedRuns = data;
        });
    };
    getActiveRuns();

    var selectNewRun = function() {
        RunService.runs({is_active: 'True'}).then(function(data) {
            $scope.activeRuns = data;

            if (data.length > 0) {
                $state.go('app.workflows.run', {id: data[-1].id});
                $scope.selectedRun = data[-1].id;
            }
        });
    };

    var selectNextRun = function() {
        $scope.selectedRun = undefined;
        $state.params.id = undefined;
        getActiveRuns();
    };

    $rootScope.$on('run-added', selectNewRun);
    $rootScope.$on('run-completed', selectNextRun);
    $rootScope.$on('run-ended', selectNextRun);
    $rootScope.$on('run-not-found', selectNextRun);

    $scope.startNewRun = function() {
        $mdDialog.show({
            templateUrl: 'modules/workflows/views/startrun.html',
            controller: 'StartRunCtrl',
            locals: {
                preSelected: false,
            },
        });
    };

});

app.controller('ActiveRunCtrl', function($scope, PageTitle, WorkflowService,
    ProjectService, RunService, $mdDialog, $state, $stateParams, $rootScope) {

    $scope.selected = [];

    var getRunData = function() {
        RunService.getRun($stateParams.id).then(function(data) {
            $scope.run = data;
            $scope.current_task = $scope.run.tasks[$scope.run.current_task];
            $scope.input_filter = {item_type: $scope.current_task.product_input};
        }).catch(function(err) {
            if (err.status == 404) {
                $rootScope.$broadcast('run-not-found');
            }
        });
    };

    getRunData();

    $rootScope.$on('run-updated', getRunData);

    $scope.addToRun = function() {
        $mdDialog.show({
            templateUrl: 'modules/workflows/views/addtorun.html',
            controller: 'AddToRunCtrl',
            locals: {
                runId: $scope.run.id,
            },
        });
    };

    $scope.removeFromRun = function() {
        var d = $mdDialog.confirm()
            .title('Remove ' + $scope.selected.length + ' products from this run?')
            .ariaLabel('Confirm remove products from run')
            .ok('Yes')
            .cancel('No');
        $mdDialog.show(d).then(function() {
            // Get a list of IDs to remove
            var productIdsToRemove = _.map($scope.selected, function(obj) {
                return obj.id;
            });
            var currentProductIds = _.map($scope.run.products, function(obj) {
                return obj.id;
            });
            var data = {products: _.difference(currentProductIds, productIdsToRemove)};
            RunService.updateRun($scope.run.id, data).then(function(data) {
                $rootScope.$broadcast('run-updated');
            });
        });
    };

    $scope.toNewRun = function(workflowId) {
        /*
        $mdDialog.show({
            templateUrl: 'modules/workflows/views/switchworkflow.html',
            controller: 'switchWorkflowCtrl',
            locals: {
                items: $scope.selected,
                workflowId: workflowId,
            },
        });
        */
    };

    $scope.stopRun = function() {
        var confirmDelete = $mdDialog.confirm()
            .title('Are you sure you want to stop this run?')
            .ariaLabel('Confirm stop run')
            .ok('Stop')
            .cancel('No');
        $mdDialog.show(confirmDelete).then(function() {
            RunService.deleteRun($scope.run.id)
                .then(function() {
                    $rootScope.$broadcast('run-ended');
                });
        });
    };

    $scope.startTask = function() {
        $mdDialog.show({
            templateUrl: 'modules/workflows/views/starttask.html',
            controller: 'StartTaskCtrl',
            locals: {
                run: $scope.run,
                task: $scope.run.tasks[$scope.run.current_task],
            },
        }).then(function() {
            $rootScope.$broadcast('run-updated');
        });
    };

    $scope.monitorTask = function() {
        $mdDialog.show({
            templateUrl: 'modules/workflows/views/monitortask.html',
            controller: 'MonitorTaskCtrl',
            locals: {
                run: $scope.run,
                task: $scope.run.tasks[$scope.run.current_task],
            },
        });
    };

    $scope.toggle = function(item, list) {
        var idx = list.indexOf(item);
        if (idx > -1) {
            list.splice(idx, 1);
        } else {
            list.push(item);
        }
    };

    $scope.exists = function(item, list) {
        return list.indexOf(item) > -1;
    };

});


app.controller('AddToRunCtrl', function($scope, $rootScope, $mdDialog,
            RunService, ProjectService, runId) {

    $scope.cancel = function() {
        $mdDialog.cancel();
    };

    $scope.productsSelected = [];

    $scope.add = function() {
        var productIds = _.map($scope.productsSelected, function(obj) {
            return obj.id;
        });
        var data = {products: productIds};
        RunService.updateRun(runId, data).then(function(data) {
            $rootScope.$broadcast('run-updated');
            $mdDialog.hide();
        });
    };

});


app.controller('StartRunCtrl', function($scope, RunService,
        WorkflowService, ErrorService, $mdDialog, $rootScope) {

    $scope.cancel = function() {
        $mdDialog.cancel();
    };

    WorkflowService.availableWorkflows().then(function(data) {
        $scope.availableWorkflows = data;
    });

    $scope.productsSelected = [];

    $scope.start = function() {
        var productIds = _.map($scope.productsSelected, function(obj) {
            return obj.id;
        });
        $scope.run.products = productIds;
        $scope.run.tasks = $scope.workflow.order;
        RunService.saveRun($scope.run).then(function(data) {
            $mdDialog.hide();
            $rootScope.$broadcast('run-added');
        }).catch(function(err) {
            $scope.errors = ErrorService.parseError(err);
        });
    };

});


app.controller('StartTaskCtrl', function($scope, $rootScope, $mdDialog,
    RunService, InventoryService, WorkflowService, task, run) {

    $scope.input_files = {};
    $scope.canStart = true;
    $scope.run = run;

    WorkflowService.getTask(task.id).then(function(data) {
        console.log(data);
        $scope.task = data;
    });

    $scope.filterLabwareItems = function(filterText, lookupType) {
        if (!lookupType) {
            lookupType = $scope.task.labware;
        }
        var params = {
            item_type__name: lookupType,
            search: filterText,
            in_inventory: 'True',
        }
        return InventoryService.items(params);
    };

    $scope.setLabwareItem = function(item) {
        $scope.task[$scope.task.store_labware_as] = item.identifier;
    };

    $scope.startTask = function(doCheck) {
        var params = {
            task: $scope.task,
            input_files: $scope.input_files,
        };
        RunService.startTask(run.id, params, doCheck).then(function(data) {
            $scope.errorMessage = '';
            console.log(data);
            if (!doCheck) {
                $mdDialog.show({
                    templateUrl: 'modules/workflows/views/monitortask.html',
                    controller: 'MonitorTaskCtrl',
                    locals: {
                        run: run,
                        task: task,
                    },
                });
                $scope.run.task_in_progress = true;
            } else {
                $scope.canStart = true;
                $scope.requirements = data.requirements;
                $scope.errorMessage = data.errors.join(', \n');
                if (data.errors.length > 0) {
                    $scope.canStart = false;
                }
            }
        }).catch(function(err) {
            console.log(err);
            if (err.data.message) {
                $scope.errorMessage = err.data.message;
                $scope.canStart = false;
            } else if (err.status == 400) {
                $scope.errorMessage = 'Please ensure all fields contain valid data';
                $scope.canStart = false;
            } else {
                $scope.errorMessage = err.status + ' ' + err.statusText;
            }
        });
    };

    $scope.getRequirements = function() {
        $scope.startTask(true);
    };

    $scope.filterSelected = function(searchText) {
        return _.filter($scope.selected, function(obj) {
            var tl = obj.name.toLowerCase();
            var st = searchText.toLowerCase();
            return tl.indexOf(st) != -1;
        });
    };

    $scope.toggle = function(item, list) {
        var idx = list.indexOf(item);
        if (idx > -1) {
            list.splice(idx, 1);
        } else {
            list.push(item);
        }
    };

    $scope.exists = function(item, list) {
        return list.indexOf(item) > -1;
    };

    $scope.cancel = $mdDialog.cancel;

});

app.controller('MonitorTaskCtrl', function($scope, $rootScope, $mdDialog,
    RunService, InventoryService, WorkflowService, API_URL, task, run) {

    $scope.task_name = task.name;

    RunService.monitorTask(run.id).then(function(data) {
        $scope.taskData = data;
        $scope.task = data.data[0].data;
        $scope.requirements = data.transfers;
        $scope.equipment_files = data.equipment_files;

        // Create an object mapping identifier -> inventory data
        // Used to link input/output objects
        $scope.inmap = {};
        _.each(data.transfers, function(obj) {
            $scope.inmap[obj.item.identifier] = {
                id: obj.item.id,
                name: obj.item.name,
            };
        });
    });

    $scope.finishTask = function() {
        $mdDialog.show({
            templateUrl: 'modules/workflows/views/finishtask.html',
            controller: 'FinishTaskCtrl',
            locals: {
                run: run,
                task: task,
            },
        });
    };

    $scope.fileLocationUrl = API_URL + 'runs/' + run.id + '/get_file/?id=';

    $scope.cancel = $mdDialog.cancel;

});


app.controller('FinishTaskCtrl', function($scope, $rootScope, $mdDialog,
    RunService, InventoryService, WorkflowService, task, run) {

    $scope.task_name = task.name;

    $scope.failed = [];

    RunService.monitorTask(run.id).then(function(data) {
        $scope.task = data;

        _.map($scope.task.data, function(obj) {
            if (obj.state == 'active') {
                obj.state = 'succeeded';
            }
        });
    });

    $scope.finishTask = function() {
        var failed = _.reduce(_.filter($scope.task.data, function(obj) {
            return obj.state == 'failed' || obj.state == 'repeat failed';
        }), function(obj) {
            return obj.product;
        });
        RunService.finishTask(run.id, failed).then(function(data) {
            $mdDialog.hide();
            if (data.is_active === false) {
                $rootScope.$broadcast('run-ended');
            } else {
                $rootScope.$broadcast('run-updated');
            }
        });
    };

});


app.controller('doTaskCtrl', function($scope, $rootScope, $mdDialog, UserService,
    WorkflowService, ProjectService, InventoryService, taskPositionId, workflowId,
    selected, selectedWorkflow) {

    $scope.product_inputs = [];
    $scope.components = [];
    $scope.selected = [];
    $scope.input_files = {};
    $scope.output_files = {};

    $scope.taskPaneSelected = 0;

    if (!taskPositionId) {
        taskPositionId = selected[0].current_task;
    }

    WorkflowService.getTaskByPosition(workflowId, taskPositionId)
        .then(function(data) {

            $scope.task = data.plain();
            // The core fields - operations on these propogate through
            // to the individual component fields.

            $scope.selected = selected;
        });

    $scope.isStarted = selected[0].task_in_progress;

    $scope.cancel = $mdDialog.cancel;

    $scope.$on('field-amount-changed', function(e, data) {
        console.log(e, data);
        WorkflowService.recalculate($scope.task.id, $scope.task).then(function(data) {
            $scope.task = data.plain();
            console.log('TASK DATA', $scope.task);
        });
    });

    $scope.filterLabwareItems = function(filterText, lookupType) {
        if (!lookupType) {
            lookupType = $scope.task.labware;
        }
        var params = {
            item_type__name: lookupType,
            search: filterText,
            in_inventory: 'True',
        }
        return InventoryService.items(params);
    };

    $scope.setLabwareItem = function(item) {
        $scope.task[$scope.task.store_labware_as] = item.identifier;
    };

    $scope.startTask = function(isPreview) {
        var params = {
            started_by: UserService.getUser().username,
            task: $scope.task,
            input_files: $scope.input_files,
            products: $scope.selected,
        }
        WorkflowService.startTask(selectedWorkflow.id, params, isPreview).then(function(data) {
            if (!isPreview) {
                $mdDialog.hide();
                $scope.isStarted = selected[0].task_in_progress;
            } else {
                $scope.requirements = data;
            }
            $scope.errorMessage = '';
        }).catch(function(err) {
            console.log(err);
            if (err.data.message) {
                $scope.errorMessage = err.data.message;
            } else if (err.status == 400) {
                $scope.errorMessage = 'Please ensure all fields contain valid data';
            } else {
                $scope.errorMessage = err.status + ' ' + err.statusText;
            }
        });
    };

    $scope.getRequirements = function() {
        $scope.startTask(true);
    };

    $scope.filterSelected = function(searchText) {
        return _.filter($scope.selected, function(obj) {
            var tl = obj.name.toLowerCase();
            var st = searchText.toLowerCase();
            return tl.indexOf(st) != -1;
        });
    };

    $scope.toggle = function(item, list) {
        var idx = list.indexOf(item);
        if (idx > -1) {
            list.splice(idx, 1);
        } else {
            list.push(item);
        }
    };

    $scope.exists = function(item, list) {
        return list.indexOf(item) > -1;
    };

});

app.controller('showActiveTaskCtrl', function($scope, $rootScope, $mdDialog, UserService,
    WorkflowService, ProjectService, InventoryService, runIdentifier,
    taskPositionId, selectedWorkflow) {

    $scope.product_inputs = [];
    $scope.components = [];
    $scope.selected = [];
    $scope.input_files = {};
    $scope.output_files = {};

    var getTaskData = function() {
        WorkflowService.getActiveTaskDetails(selectedWorkflow.id, runIdentifier, taskPositionId)
            .then(function(data) {

                $scope.task = data;
                $scope.selected = _.map(data.items, function(obj, key) {
                return obj[0].id;
            });
                if (Object.keys(data.items).length > 0) {
                    var first = Object.keys(data.items)[0];
                    $scope.table_column_headers = _.map(data.items[first][0].fields, function(obj) {
                    return obj.label;
                });
                }
            }).catch(function(err) {
            console.log(err);
            if (err.status == 410) {
                $rootScope.$broadcast('workflow-updated');
                $mdDialog.hide();
            }
        });
    };
    getTaskData();

    $scope.cancel = $mdDialog.cancel;

    $scope.completeAll = function() {
        var data = _.uniq(_.map($scope.task, function(obj) {
            return obj;
        }));
        WorkflowService.completeTask(selectedWorkflow.id, data).then(function() {
            $rootScope.$broadcast('workflow-updated');
            $mdDialog.hide();
        }).catch(function(err) {
            if (err.status == 410) {
                $rootScope.$broadcast('workflow-updated');
                $mdDialog.hide();
            }
        });
    };

    $scope.completeSelected = function() {
        var data = _.uniq(_.map($scope.selected, function(obj) {
            return obj;
        }));
        WorkflowService.completeTask(selectedWorkflow.id, data).then(function() {
            $rootScope.$broadcast('workflow-updated');
            getTaskData();
        }).catch(function(err) {
            if (err.status == 410) {
                $rootScope.$broadcast('workflow-updated');
                $mdDialog.hide();
            }
        });
    };

    $scope.retrySelected = function() {
        var data = _.uniq(_.map($scope.selected, function(obj) {
            return obj;
        }));
        WorkflowService.retryTask(selectedWorkflow.id, data).then(function() {
            $rootScope.$broadcast('workflow-updated');
            $mdDialog.hide();
        }).catch(function(err) {
            if (err.status == 410) {
                $rootScope.$broadcast('workflow-updated');
                $mdDialog.hide();
            }
        });
    };

    $scope.filterSelected = function(searchText) {
        return _.filter($scope.selected, function(obj) {
            var tl = obj.name.toLowerCase();
            var st = searchText.toLowerCase();
            return tl.indexOf(st) != -1;
        });
    };

    $scope.toggle = function(item, list) {
        var idx = list.indexOf(item);
        if (idx > -1) {
        list.splice(idx, 1); } else {
            list.push(item);
        }
    };

    $scope.exists = function(item, list) {
        return list.indexOf(item) > -1;
    };

});

app.controller('FullWorkflowCtrl', function($scope, PageTitle,
    ProjectService, WorkflowService, $stateParams, $mdDialog, $rootScope,
    $q, UserService) {

    $scope.removePadding = true;

    // MARKER
    var getWorkflowData = function() {
        WorkflowService.fullActiveWorkflow($stateParams.id).then(function(data) {
            $scope.workflow = data;
            PageTitle.set('Workflow: ');
        });
    };
    getWorkflowData();

    $rootScope.$on('workflow-updated', getWorkflowData);

    $scope.notOnWorkflow = function(value, index, array) {
        if (value.on_workflow.length > 0) {
            return false;
        }
        return true;
    };

    $scope.addToWorkflow = function(workflowId) {
        $mdDialog.show({
            templateUrl: 'modules/projects/views/addtoworkflow.html',
            controller: 'addToWorkflowCtrl',
            locals: {
                workflowId: workflowId,
                products: $scope.products,
            },
        });
    };

    $scope.removeFromWorkflow = function(workflowId, productId) {
        WorkflowService.removeProduct(workflowId, productId).then(function() {
            $rootScope.$broadcast('workflow-updated');
        });
    };

    $scope.switchWorkflow = function(item, workflowId) {
        $mdDialog.show({
            templateUrl: 'modules/projects/views/switchworkflow.html',
            controller: 'switchWorkflowCtrl',
            locals: {
                items: [item],
                workflowId: workflowId,
            },
        });
    };
});

app.directive('gtlSelectProduct', function(ProjectService) {
    return {
        restrict: 'E',
        scope: {
            productsList: '=',
        },
        templateUrl: 'modules/workflows/views/gtl-select-product.html',
        link: function($scope, elem, attr) {

            $scope.currentPage = 1;

            var productParams = {
                ordering: 'project,identifier',
                limit: 10,
                on_run: 'False',
                search: $scope.filterText,
            };

            $scope.getProducts = function(params) {
                productParams = _.merge(productParams, params);
                productParams.search = $scope.filterText;
                ProjectService.products(productParams).then(function(data) {
                    if (!$scope.currentPage) {
                        $scope.currentPage = data.meta.current;
                    }
                    $scope.nextPage = data.meta.next;
                    $scope.previousPage = data.meta.previous;
                    $scope.numPages = data.meta.pages;
                    $scope.productsAvailable = data;
                });
            };
            $scope.getProducts();

            $scope.$watch('filterText', function(n, o) {
                $scope.getProducts();
            });

            $scope.$watch('currentPage', function(n, o) {
                if (n && n != o) {
                    $scope.getProducts({page: n});
                }
            }, true);

            $scope.gotoNextPage = function() {
                $scope.currentPage += 1;
            };

            $scope.gotoPreviousPage = function() {
                $scope.currentPage -= 1;
            };

            $scope.selected = [];
            $scope.selectedToUse = [];

            $scope.selectAll = function() {
                _.each($scope.productsAvailable, function(obj) {
                    $scope.selected.push(obj);
                });
            };

            $scope.deselectAll = function() {
                _.each($scope.productsAvailable, function(obj) {
                    var idx = $scope.selected.indexOf(obj);
                    if (idx > -1) {
                        $scope.selected.splice(idx, 1);
                    }
                });
            };

            $scope.toggle = function(item, list) {
                var idx = list.indexOf(item);
                if (idx > -1) {
                    list.splice(idx, 1);
                } else {
                    list.push(item);
                }
            };

            $scope.exists = function(item, list) {
                return list.indexOf(item) > -1;
            };

            $scope.addToSelected = function() {
                _.each($scope.selected, function(obj) {
                    var idx = $scope.productsList.indexOf(obj);
                    if (idx == -1) {
                        $scope.productsList.push(obj);
                    }
                });
            };

            $scope.isEnabled = function(item, list) {
                return _.find(list, {id: item.id}) ? true : false;
            };

            $scope.removeItem = function() {
                _.each($scope.selectedToUse, function(obj) {
                    var idx = $scope.productsList.indexOf(obj);
                    if (idx > -1) {
                        $scope.productsList.splice(idx, 1);
                    }
                });
            };
        },
    }
});


app.directive('gtlWorkflowTaskPreview', function() {
    return {
        restrict: 'E',
        scope: {
            task: '=',
            taskNumber: '=',
            taskCount: '=',
            isSelected: '=',
        },
        templateUrl: 'modules/workflows/views/gmworkflowtaskpreview.html',
        link: function(scope, elem, attr) {
            scope.taskNum = scope.taskNumber + 1;
            if (attr.hasOwnProperty('current')) {
                scope.isCurrent = true;
            }
        },
    }
});

app.directive('gmProductListItem', function() {
    return {
        restrict: 'A',
        scope: {
            item: '=',
        },
        templateUrl: 'modules/workflows/views/gmproductlistitem.html',
        transclude: true,
    }
});

app.service('WorkflowService', function(Restangular) {

    this.availableWorkflows = function(params) {
        // Get a list of workflow templates
        if (!params) {
            params = {};
        }
        return Restangular.all('workflows').getList(params);
    };

    this.saveWorkflowTemplate = function(workflowData) {
        return Restangular.all('workflows').post(workflowData);
    };

    this.updateWorkflowTemplate = function(workflowId, workflowData) {
        return Restangular.one('workflows', workflowId).patch(workflowData);
    };

    this.deleteWorkflowTemplate = function(workflowId) {
        return Restangular.one('workflows', workflowId).remove();
    };

    this.workflowTasks = function(workflowId) {
        return Restangular.one('workflows', workflowId).customGET('tasks');
    };

    this.availableTasks = function(params) {
        if (!params) {
            params = {};
        }
        return Restangular.all('tasks').getList(params);
    };

    this.availableTaskTypes = function() {
        return Restangular.all('tasks').customGETLIST('task_types');
    };

    this.getTaskByPosition = function(workflowId, taskPositionId) {
        return Restangular.one('workflows', workflowId)
            .customGET('task_details', {position: taskPositionId});
    };

    // DEPRECIATED!!
    this.task = function(taskId) {
        return Restangular.one('tasks', taskId).get();
    };

    this.getTask = function(taskId) {
        return Restangular.one('tasks', taskId).get();
    };

    this.saveTaskTemplate = function(templateData) {
        return Restangular.all('tasks').post(templateData);
    };

    this.updateTaskTemplate = function(taskId, templateData) {
        return Restangular.one('tasks', taskId).patch(templateData);
    };

    this.deleteTaskTemplate = function(taskId) {
        return Restangular.one('tasks', taskId).remove();
    };

    this.saveTaskField = function(taskFieldData, fieldType) {
        return Restangular.all('taskfields').post(taskFieldData, {type: fieldType});
    };

    this.updateTaskField = function(fieldId, taskFieldData, fieldType) {
        return Restangular.one('taskfields', fieldId).patch(taskFieldData, {type: fieldType});
    };

    this.deleteTaskField = function(fieldId, fieldType) {
        return Restangular.one('taskfields', fieldId).remove({type: fieldType});
    };

});

app.service('RunService', function(Restangular) {

    this.runs = function(params) {
        if (!params) {
            params = {};
        }
        return Restangular.all('runs').getList(params);
    };

    this.getRun = function(runId) {
        return Restangular.one('runs', runId).get();
    };

    this.saveRun = function(runData) {
        return Restangular.all('runs').post(runData);
    };

    this.updateRun = function(runId, runData) {
        return Restangular.one('runs', runId).patch(runData);
    };

    this.deleteRun = function(runId) {
        return Restangular.one('runs', runId).remove();
    };

    this.startTask = function(runId, taskData, doCheck) {
        var params = {};
        if (doCheck) {
            params.is_check = 'True';
        }
        var frmData = new FormData();
        for (var key in taskData) {
            if (key !== 'input_files') {
                frmData.append(key, JSON.stringify(taskData[key]));
            } else {
                for (var fl in taskData.input_files) {
                    frmData.append(key, taskData.input_files[fl], fl);
                }
            }
        }
        return Restangular.one('runs', runId)
            .withHttpConfig({transformRequest: angular.identity})
            .customPOST(frmData, 'start_task', params, {
                'Content-Type': undefined,
            });
    };

    this.monitorTask = function(runId) {
        return Restangular.one('runs', runId).customGET('monitor_task');
    };

    this.finishTask = function(runId, failedProducts) {
        return Restangular.one('runs', runId).customPOST({failed_products: failedProducts},
                                                         'finish_task');
    };

    this.workflowFromRun = function(runId, workflowName) {
        return Restangular.one('runs', runId).customPOST({},
                                                         'workflow_from_run',
                                                         {name: workflowName});
    };

});
