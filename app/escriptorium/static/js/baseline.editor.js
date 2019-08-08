/*
Baseline editor
a javascript based baseline segmentation editor,
requires paper.js and colorThief is optional.

Usage:
var segmenter = new Segmenter(img, options);
segmenter.load([{baseline: [[0,0],[10,10]], mask: null}]);

Options:
  lengthTreshold=15
  disableMasks=false // td
  mainColor
  secondaryColor
  lengthTreshold=15,
  delayInit=false,
  deletePointBtn=null,
  deleteSelectionBtn=null,
  toggleMasksBtn=null,
  splitBtn=null,
  mergeBtn=null,
  upperLineHeight=15,
  lowerLineHeight=5

*/

function isRightClick(event) {
    return event.which === 3 || event.button === 2;
}

class SegmenterRegion {
    constructor(polygon, context, segmenter_) {
        this.segmenter = segmenter_;
        this.polygon = polygon;
        this.context = context;
        this.selected = false;
        this.changed = false;
        this.polygonPath = new Path({
            closed: true,
            opacity: 0.2,
            strokeColor: this.segmenter.mainColor,
            strokeWidth: 1,
            fillColor: this.segmenter.mode == 'regions' ? this.segmenter.secondaryColor : null,
            // selectedColor: this.segmenter.secondaryColor,
            visible: true,
            segments: this.polygon
        });
    }

    select() {
        if (this.selected) return;
        this.polygonPath.selected = true;
        this.polygonPath.bringToFront();
        this.segmenter.addToSelection(this);
        this.selected = true;
    }

    unselect() {
        if (!this.selected) return;
        this.polygonPath.selected = false;
        this.segmenter.removeFromSelection(this);
        this.selected = false;
    }

    toggleSelect() {
        if (this.selected) this.unselect();
        else this.select();
    }
    
    updateDataFromCanvas() {
        this.polygon = this.polygonPath.segments.map(s => [Math.round(s.point.x), Math.round(s.point.y)]);
    }
    
    remove() {
        this.polygonPath.remove();
    }

    delete() {
        this.remove();
        this.segmenter.trigger('baseline-editor:delete', {regions: [this]});
    }
}

class SegmenterLine {
    constructor(baseline, mask, context, segmenter_) {
        this.segmenter = segmenter_;
        this.mask = mask;
        this.context = context;
        this.selected = false;
        this.changed = false;

        this.directionHint = null;
        
        var line_ = this;  // save in scope

        this.maskPath = new Path({
            closed: true,
            opacity: 0.1,
            fillColor: this.segmenter.mainColor,
            selectedColor: this.segmenter.secondaryColor,
            visible: !baseline || this.segmenter.showMasks,
            segments: this.mask
        });

        if (baseline) {
            if(baseline.segments) {  // already a paperjs.Path
                this.baselinePath = baseline;
                this.updateDataFromCanvas();
            } else {
                this.baseline = baseline;
                this.baselinePath = new Path({
                strokeColor: segmenter_.mainColor,
                strokeWidth: 7,
                strokeCap: 'round',
                selectedColor: 'black',
                opacity: 0.5,
                segments: this.baseline,
                selected: false,
                visible: true
                });
            }
        } else {
            // No baseline !
            this.baseline = null;
        }
        this.showDirection();
    }

    createPolygonEdgeForBaselineSegment(segment) {
        let pt = segment.point;
        let vector = segment.path.getNormalAt(segment.index);
        if (Math.sin(vector.angle/180*Math.PI) > 0) vector = vector.rotate(180);  // right to left
        
        vector.length = this.segmenter.upperLineHeight;
        let up = this.maskPath.insert(segment.index, pt.add(vector));
        
        vector.length = this.segmenter.lowerLineHeight;
        let low = this.maskPath.insert(this.maskPath.segments.length-segment.index, pt.subtract(vector));
        return [up, low];
    }
    deletePolygonsEdgeForBaselineSegment(segment) {
        this.maskPath.removeSegment(this.maskPath.segments.length-segment.index-1);
        this.maskPath.removeSegment(segment.index);
    }
    
    createMask() {
        for (let i in this.baselinePath.segments) {
            this.createPolygonEdgeForBaselineSegment(this.baselinePath.segments[i]);
        }
        this.updateDataFromCanvas();
        this.setLineHeight();
    }
    
    dragPolyEdges(j, delta) {
        let poly = this.maskPath;
        if (poly && poly.segments.length) {
            let top = poly.segments[this.baselinePath.segments.length*2 - j - 1].point;
            let bottom = poly.segments[j].point;
            this.segmenter.movePointInView(top, delta);
            this.segmenter.movePointInView(bottom, delta);
        }
    }
    
    select() {
        if (this.selected) return;
        if (this.maskPath && this.maskPath.visible) this.maskPath.selected = true;
        if (this.baselinePath) {
            this.baselinePath.selected = true;
            this.baselinePath.bringToFront();
            this.baselinePath.strokeColor = this.segmenter.secondaryColor;
        }
        if (this.maskPath) this.maskPath.bringToFront();
        if (this.directionHint) this.directionHint.visible = true;
        else this.showDirection();
        this.segmenter.addToSelection(this);
        this.selected = true;
    }

    unselect() {
        if (!this.selected) return;
        if (this.maskPath) this.maskPath.selected = false;
        if(this.baselinePath) {
            this.baselinePath.selected = false;
            this.baselinePath.strokeColor = this.segmenter.mainColor;
        }
        this.segmenter.removeFromSelection(this);
        if (this.directionHint) this.directionHint.visible = false;
        this.selected = false;
    }
    
    toggleSelect() {
        if (this.selected) this.unselect();
        else this.select();
    }

    updateDataFromCanvas() {
        if (this.baselinePath) this.baseline = this.baselinePath.segments.map(s => [Math.round(s.point.x), Math.round(s.point.y)]);
        if (this.maskPath) this.mask = this.maskPath.segments.map(s => [Math.round(s.point.x), Math.round(s.point.y)]);
    }
    
    extend(point) {
        return this.baselinePath.add(point);
    }
    
    close() {
        if (this.baselinePath.length < this.segmenter.lengthThreshold) {
            this.delete();
        }
        this.baselinePath.smooth({ type: 'catmull-rom', 'factor': 0.2 });
        this.createMask();
    }
    
    remove() {
        this.unselect();
        if(this.baselinePath) this.baselinePath.remove();
        if(this.maskPath) this.maskPath.remove();
        this.segmenter.lines.splice(this.segmenter.lines.indexOf(this), 1);
    }

    delete() {
        this.remove();
        this.segmenter.trigger('baseline-editor:delete', {lines: [this]});
    }
    
    showDirection() {
        if (this.baselinePath && this.baselinePath.segments.length > 1) {
            if (this.directionHint) this.directionHint.remove();
            let vector = this.baselinePath.segments[1].point.subtract(this.baselinePath.firstSegment.point);
            vector.length = 20;
            var start = this.baselinePath.firstSegment.point;
            var end = start.add(vector);
            vector.length = 10;
            this.directionHint =  new Path({
                visible: this.selected,
                shadowColor: 'white', shadowOffset: new Point(1,1), shadowBlur: 1,
                strokeWidth: 1, strokeColor: this.segmenter.mainColor, opacity: 1,
                segments:[
                    end.add(vector.rotate(-150)),
                    end,
                    end.add(vector.rotate(150))]
            });
            if (Math.cos(vector.angle/180*Math.PI) > 0) this.directionHint.translate(vector.rotate(90));
            else this.directionHint.translate(vector.rotate(-90));
        }
    }
    
    setLineHeight() {
        if (this.baseline && this.mask) {
            // distance avg implementation
            /* let sum = 0;
            this.baseline.forEach(function(segment){
                let top = this.maskPath.segments[this.maskPath.segments.length-segment.index-1];
                let bottom = this.maskPath.segments[segment.index];
                sum += top.distance(bottom);
            }.bind(this));
            return sum / this.baseline.length; */

            // area implementation
            this.lineHeight = Math.abs(this.maskPath.area) / this.baselinePath.length;
            if (this.lineHeight) {
                this.baselinePath.strokeWidth = Math.max(this.lineHeight / 6, 3);
            }
        }
    }
}

class Segmenter {
    constructor(image, {lengthTreshold=10,
                        delayInit=false,
                        deletePointBtn=null,
                        deleteSelectionBtn=null,
                        toggleMasksBtn=null,
                        toggleRegionModeBtn=null,
                        splitBtn=null,
                        mergeBtn=null,
                        undoBtn=null,
                        redoBtn=null,
                        disableMasks=false, // td
                        mainColor=null,
                        secondaryColor=null,
                        upperLineHeight=20,
                        lowerLineHeight=10,
                        // field to store and reuse in output from loaded data
                        // can be set to null to disable behavior
                        idField='id'
                       } = {}) {
        this.img = image;
        this.imgRatio = null;  // img may not be loaded yet

        this.canvas = document.createElement('canvas');
        this.canvas.className += 'resize';

        this.idField = idField;
        
        // create a dummy tag for event bindings
        this.events = document.createElement('div');
        this.events.setAttribute('id', 'baseline-editor-events');
        document.body.appendChild(this.events);
        
        // this.raster = null;
        // insert after..
        this.img.parentNode.insertBefore(this.canvas, this.img);
        this.mainColor = null;
        this.secondaryColor = null;
        this.upperLineHeight = upperLineHeight;
        this.lowerLineHeight = lowerLineHeight;
        
        this.lines = [];
        this.regions = [];
        this.selection = [];
        // the minimal length in pixels below which the line will be removed automatically
        this.lengthThreshold = lengthTreshold;
        this.showMasks = false;

        this.mode = 'lines'; // | 'regions'
        this.selecting = null;
        this.spliting = false;
        this.copy = null;
        
        this.stateIndex = -1;
        this.states = [];
        this.maxStates = 30;
        
        this.deletePointBtn = deletePointBtn || document.getElementById('delete-point');
        this.deletePointBtn.style.zIndex = 3;
        this.toggleMasksBtn = toggleMasksBtn || document.getElementById('toggle-masks');
        this.splitBtn = splitBtn || document.getElementById('split-lines');
        this.toggleRegionModeBtn = toggleRegionModeBtn || document.getElementById('toggle-regions');
        this.deleteSelectionBtn = deleteSelectionBtn || document.getElementById('delete-selection');
        this.undoBtn = undoBtn || document.getElementById('undo');
        this.redoBtn = redoBtn || document.getElementById('redo');
        this.mergeBtn = mergeBtn || document.getElementById('merge-selection');
        // create a menu for the context buttons
        this.contextMenu = document.createElement('div');
        this.contextMenu.id = 'context-menu';
        this.contextMenu.style.position = 'fixed';
        this.contextMenu.style.display = 'none';
        this.contextMenu.style.zIndex = 3;
        this.contextMenu.style.border = '1px solid grey';
        this.contextMenu.style.borderRadius = '5px';
        this.deleteSelectionBtn.parentNode.insertBefore(this.contextMenu, this.deleteSelectionBtn);
        this.contextMenu.appendChild(this.mergeBtn);
        this.contextMenu.appendChild(this.deleteSelectionBtn);
        
        // init paperjs
        if (!delayInit) {
            this.init();
        }
    }

    init() {
        paper.settings.handleSize = 10;
        paper.settings.hitTolerance = 10;  // Note: doesn't work?
        paper.install(window);
        paper.setup(this.canvas);
        
        var hitOptions = { type : ('path'), segments: true, stroke: true, fill: true, tolerance: 5 };
        
        var tool = new Tool();
        this.setColors(this.img);
        this.setCursor();

        // make sure we capture clicks before the img
        this.canvas.style.zIndex = this.img.style.zIndex + 1;
        this.refresh();
        
        this.canvas.style.width = this.img.width;
        this.canvas.style.height = this.img.height;
        // this.raster = new Raster(this.img);  // Note: this seems to slow down everything significantly
        // this.raster.position = view.center;
        this.img.style.display = 'hidden';

        // context follows top right, width can only be calculated once shown
        this.contextMenu.style.top = (this.img.getBoundingClientRect().top+10)+'px';
        this.contextMenu.style.margin = '10px';
        this.addState();
        
        tool.onMouseDown = this.onMouseDown.bind(this);
        
        this.deleteSelectionBtn.addEventListener('click', function(event) {
            for (let i=this.selection.length-1; i >= 0; i--) {    
                this.selection[i].delete();
            }
            this.addState();
        }.bind(this));

        if (this.toggleRegionModeBtn) this.toggleRegionModeBtn.addEventListener('click', function(event) {
            this.toggleRegionMode();
        }.bind(this));
        
        if (this.toggleMasksBtn) this.toggleMasksBtn.addEventListener('click', function(event) {
            this.toggleMasks();
        }.bind(this));

        if (this.splitBtn) this.splitBtn.addEventListener('click', function(event) {
            this.spliting = !this.spliting;
            this.splitBtn.classList.toggle('btn-info');
            this.splitBtn.classList.toggle('btn-success');
            this.setCursor();
        }.bind(this));
        if (this.mergeBtn) this.mergeBtn.addEventListener('click', function(event) {
            this.mergeSelection();
        }.bind(this));
        if (this.undoBtn) this.undoBtn.addEventListener('click', function(event) {
            this.loadPreviousState();
        }.bind(this));
        if (this.redoBtn) this.redoBtn.addEventListener('click', function(event) {
            this.loadNextState();
        }.bind(this));

        
        document.addEventListener('keyup', function(event) {
            if (event.keyCode == 27) { // escape
                this.purgeSelection();
            } else if (event.keyCode == 46) { // supr
                for (let i=this.selection.length-1; i >= 0; i--) {    
                    this.selection[i].delete();
                }
            } else if (event.keyCode == 67) { // C
                this.spliting = !this.spliting;
                this.splitBtn.classList.toggle('btn-info');
                this.splitBtn.classList.toggle('btn-success');
                this.setCursor();
            } else if (event.keyCode == 77) { // M
                this.toggleMasks();
            } else if (event.keyCode == 82) { // R
                this.toggleRegionMode();
            } else if (event.keyCode == 65 && event.ctrlKey) { // Ctrl+A
                event.preventDefault();
                event.stopPropagation();
                // select all
                if (this.mode == 'lines') {
                    for (let i in this.lines) this.lines[i].select();
                } else if (this.mode == 'regions') {
                    for (let i in this.regions) this.regions[i].select();
                }
                return false;
            } else if (event.ctrlKey && event.keyCode == 90) {  // Ctrl+Z -> Undo
                this.loadPreviousState();
            } else if (event.ctrlKey && event.keyCode == 89) {  // Ctrl+Y -> Redo
                this.loadNextState();
            }
            
            // } else if (event.keyCode == 67 && event.ctrlKey) {  // Ctrl+C
            //     this.copy = this.selection.map(a => [
            //         a.baselinePath.exportJSON({asString: false})[1].segments,
            //         a.maskPath.exportJSON({asString: false})[1].segments
            //     ]);
            // } else if (event.keyCode == 86 && event.ctrlKey) {  // Ctrl+V
            //     if (this.copy && this.copy.length) {
            //         var vector, lastPt, beforeLastPt;
            //         if (this.lines.length >= 2) {
            //             lastPt = this.lines[this.lines.length-1].baselinePath.segments[0].point;
            //             beforeLastPt = this.lines[this.lines.length-2].baselinePath.segments[0].point;
            //             vector = new Point(lastPt - beforeLastPt);
            //         } else {
            //             vector = { x: 0, y: 30 };
            //         }
                        
            //         for (let i in this.copy) {
            //             let newLine = this.createLine(this.copy[i][0], this.copy[i][1]);
            //             newLine.changed = true;
            //             if (lastPt) {
            //                 let newLastPt = this.lines[this.lines.length-1].baselinePath.segments[0].point;
            //                 vector = new Point(
            //                     (newLastPt.x - newLine.baseline[0][0]) + vector.x,
            //                     (newLastPt.y - newLine.baseline[0][1]) + vector.y
            //                 );
            //             }
            //             newLine.baselinePath.translate(vector);
            //             newLine.maskPath.translate(vector);
            //         }
            //     }
            
        }.bind(this));

        document.addEventListener('click', function(event) {
            if (event.target != this.canvas) {
                this.purgeSelection();
            }
        }.bind(this));

        this.tool = tool;
        return tool;
    }
    
    createLine(baseline, mask, context, postponeEvents) {
        if (this.idField) {
            if (context === undefined || context === null) {
                context = {};
            }
            if (context[this.idField] === undefined) {
                // make sure the client receives a value for its id, even if it's null for a new line
                context[this.idField] = null;
            }
        }
        var line = new SegmenterLine(baseline, mask, context, this);
        if (!postponeEvents) this.bindLineEvents(line);
        this.lines.push(line);
        return line;
    }

    finishLine(line) {
        line.close();
        this.bindLineEvents(line);
        this.resetToolEvents();  // unregistering
        this.addState();
        this.trigger('baseline-editor:update', {lines: [line]});
    }

    createRegion(polygon, context, postponeEvents) {
        if (this.idField) {
            if (context === undefined || context === null) {
                context = {};
            }
            if (context[this.idField] === undefined) {
                // make sure the client receives a value for its id, even if it's null for a new region
                context[this.idField] = null;
            }
        }
        var region = new SegmenterRegion(polygon, context, this);
        if (!postponeEvents) this.bindRegionEvents(region);
        this.regions.push(region);
        return region;
    }

    finishRegion(region) {
        this.bindRegionEvents(region);
        this.resetToolEvents();
        region.updateDataFromCanvas();
        this.addState();
        this.trigger('baseline-editor:update', {regions: [region]});
    }

    bindRegionEvents(region) {
        region.polygonPath.onMouseDown = function(event) {
            if (event.event.ctrlKey ||
                this.selecting ||
                isRightClick(event.event) ||
                this.mode != 'regions') return;
            this.selecting = region;
            
            var dragging = region.polygonPath.getNearestLocation(event.point).segment;
            this.tool.onMouseDrag = function(event) {
                if (event.event.ctrlKey) {
                    this.multiMove(event);
                } else {
                    this.movePointInView(dragging.point, event.delta);
                    region.changed = true;
                }
                
            }.bind(this);

            var hit = region.polygonPath.hitTest(event.point, {
	            segments: true,
	            tolerance: 20
            });
            if (hit && hit.type=='segment' && region.polygon.length > 3) {
                let pt = view.projectToView(hit.segment.point);
                this.deletePointBtn.style.left = pt.x - 20 + 'px';
                this.deletePointBtn.style.top = pt.y - 40 + 'px';
                this.deletePointBtn.style.display = 'inline';
                this.deletePointBtn.addEventListener('click', function() {
                    hit.segment.remove();
                    this.deletePointBtn.style.display = 'none';
                    region.updateDataFromCanvas();
                    this.addState();
                }.bind(this), {once: true});
            }
            this.tool.onMouseUp = function(event) {
                this.resetToolEvents();
                let changes = this.updateRegionsFromCanvas();
                if (changes) this.addState();
            }.bind(this);
        }.bind(this);

        region.polygonPath.onDoubleClick = function(event) {
            if (event.event.ctrlKey || this.mode != 'regions') return;
            let location = region.polygonPath.getNearestLocation(event.point);
            let newSegment = region.polygonPath.insert(location.index+1, location);
            region.changed = true;
            this.addState();
        }.bind(this);
    }
    
    bindLineEvents(line) {
        if (line.baselinePath) {
            line.baselinePath.onMouseDown = function(event) {
                if (event.event.ctrlKey ||
                    isRightClick(event.event) ||
                    this.mode != 'lines' ||
                    this.selecting) return;
                
                this.selecting = line;
                var hit = line.baselinePath.hitTest(event.point, {
	                segments: true,
	                tolerance: 20
                });
                
                if (hit && hit.type=='segment' &&
                    hit.segment.index != 0 &&
                    hit.segment.index != hit.segment.path.segments.length-1) {
                    let pt = view.projectToView(hit.segment.point);
                    this.deletePointBtn.style.left = pt.x - 20 + 'px';
                    this.deletePointBtn.style.top = pt.y - 40 + 'px';
                    this.deletePointBtn.style.display = 'inline';
                    this.deletePointBtn.addEventListener('click', function() {
                        line.deletePolygonsEdgeForBaselineSegment(hit.segment);
                        hit.segment.remove();
                        this.deletePointBtn.style.display = 'none';
                        this.addState();
                    }.bind(this), {once: true});
                }
                
                var dragging = line.baselinePath.getNearestLocation(event.point).segment;
                this.tool.onMouseDrag = function(event) {
                    if (event.event.ctrlKey) {
                        this.multiMove(event);
                    } else {
                        this.movePointInView(dragging.point, event.delta);
                        this.setCursor('move');
                        line.showDirection();
                        line.dragPolyEdges(dragging.index, event.delta);
                        line.changed = true;
                    }
                }.bind(this);
                
                this.tool.onMouseUp = function(event) {
                    this.resetToolEvents();
                    let changes = this.updateLinesFromCanvas();
                    if (changes) this.addState();
                }.bind(this);
                
            }.bind(this);

            line.baselinePath.onDoubleClick = function(event) {
                if (event.event.ctrlKey || this.mode != 'lines') return;
                let location = line.baselinePath.getNearestLocation(event.point);
                let newSegment = line.baselinePath.insert(location.index+1, location);
                line.baselinePath.smooth({ type: 'catmull-rom', 'factor': 0.2 });
                line.createPolygonEdgeForBaselineSegment(newSegment);
                line.changed = true;
            }.bind(this);
            
            line.baselinePath.onMouseMove = function(event) {
                if (event.event.ctrlKey || this.mode != 'lines') return;
                if (line.selected) this.setCursor('grab');
                else this.setCursor('pointer');
                var hit = line.baselinePath.hitTest(event.point, {
	                segments: true,
	                tolerance: 5
                });
                if (hit && hit.type=='segment' &&
                    hit.segment.index != 0 &&
                    hit.segment.index != hit.segment.path.segments.length-1) {
                    this.setCursor('pointer');
                }
            }.bind(this);
            
            line.baselinePath.onMouseLeave = function(event) {
                this.setCursor();
            }.bind(this);
            
            // line.baselinePath.onMouseDrag = function(event) {
            //     if (event.event.ctrlKey || this.mode != 'lines') return;
            //     this.setCursor('move');
            // }.bind(this);
        }
            
        // same for the masks
        if (line.maskPath) {
            line.maskPath.onMouseDown = function(event) {
                if (event.event.ctrlKey ||
                    isRightClick(event.event) ||
                    this.selecting ||
                    this.mode != 'lines') return;
                this.selecting = line;

                var dragging = line.maskPath.getNearestLocation(event.point).segment;
                this.tool.onMouseDrag = function(event) {
                    if (event.event.ctrlKey) {
                        this.multiMove(event);
                    } else {
                        this.movePointInView(dragging.point, event.delta);
                        line.changed = true;
                    }
                }.bind(this);
                
                this.tool.onMouseUp = function(event) {
                    this.resetToolEvents();
                    let changes = this.updateLinesFromCanvas();
                    if (changes) {
                        this.addState();
                        line.setLineHeight();
                    }
                }.bind(this);
            }.bind(this);
            line.maskPath.onMouseMove = function(event) {
                if (event.event.ctrlKey || this.mode != 'lines') return;
                if (line.selected) this.setCursor('grab');
                else this.setCursor('pointer');
            }.bind(this);
            line.maskPath.onMouseLeave = function(event) {
                this.setCursor();
            }.bind(this);
            line.maskPath.onMouseDrag = function(event) {
                if (event.event.ctrlKey || this.mode != 'lines') return;
                this.setCursor('move');
            }.bind(this);
        }        
    }
    
    resetToolEvents() {
        this.tool.onMouseDown = this.onMouseDown.bind(this);
        this.tool.onMouseDrag = this.onMouseDrag.bind(this);
        this.tool.onMouseMove = null;
        this.tool.onMouseUp = null;
    }

    multiMove(event) {
        // multi move
        if (this.mode == 'lines') {
            for (let i in this.selection) {
                this.movePointInView(this.selection[i].baselinePath.position, event.delta);
                this.movePointInView(this.selection[i].maskPath.position, event.delta);
                this.selection[i].showDirection();
                this.selection[i].changed = true;
            }
        } else if (this.mode == 'regions') {
            for (let i in this.selection) {
                this.movePointInView(this.selection[i].polygonPath.position, event.delta);
                // this.selection[i].polygonPath.position = this.selection[i].polygonPath.position.add(event.delta);
                this.selection[i].changed = true;
            }
        }
    }
    
    onMouseDrag (event) {
        if (event.event.ctrlKey) this.multiMove(event);
    }
    
    onMouseDown (event) {
        if (isRightClick(event.event)) return;
        
        if (this.selecting) {
            // selection
            if (event.event.shiftKey) {
                this.selecting.toggleSelect();
            } else {
                this.selecting.select();
                this.purgeSelection(this.selecting);
            }
            this.selecting = null;
        } else {
            if (event.event.ctrlKey) return;
            if (this.spliting) {
                this.startCuter(event);
            } else if (event.event.shiftKey) {
                // lasso selection tool
                this.startLassoSelection(event);
            } else if (this.mode == 'regions') {
                this.startNewRegion(event);
            } else {  // mode = 'lines'
                // create a new line
                this.startNewLine(event);
            }
        }
    }
    
    startNewLine(event) {
        this.purgeSelection();
        let newLine = this.createLine([[event.point.x, event.point.y]], null, null, true);
        let point = newLine.extend(event.point).point;  // the point that we move around
        newLine.showDirection();
        
        // adds all the events bindings 
        let onCancel = function(event) {
            if (event.keyCode == 27) {  // escape
                newLine.remove();
                this.resetToolEvents();
                document.removeEventListener('keyup', onCancel);
                return false;
            }
            return null;
        }.bind(this);
        
        this.tool.activate();
        this.tool.onMouseDown = function(event) {
            if (isRightClick(event.event)) {
                point = newLine.extend(event.point).point;
            } else {
                this.finishLine(newLine);
                document.removeEventListener('keyup', onCancel);
            }
        }.bind(this);
        this.tool.onMouseMove = function(event) {
            this.tool.onMouseDrag = null; // manually disable free drawing now to avoid having both
            // follow the mouse cursor with the last created point
            this.movePointInView(point, event.delta);
            newLine.showDirection();
            newLine.select();  // select it to make drawing more precise
        }.bind(this);
        this.tool.onMouseDrag = function(event) {
            // adding points to current line
            this.tool.onMouseMove = null; // we don't want the first point to move around
            point = newLine.extend(event.point).point;
            this.tool.onMouseUp = function(event) {
                newLine.baselinePath.simplify(10);
                this.finishLine(newLine);
                document.removeEventListener('keyup', onCancel);
            }.bind(this);
        }.bind(this);
        document.addEventListener('keyup', onCancel);
    }
    
    startNewRegion(event) {
        this.purgeSelection();
        var originPoint = event.point;
        let newRegion = this.createRegion([
            [event.point.x, event.point.y],
            [event.point.x, event.point.y+1],
            [event.point.x+1, event.point.y+1],
            [event.point.x+1, event.point.y]
        ], null);
        newRegion.changed = true;
        
        let onCancel = function(event) {
            if (event.keyCode == 27) {  // escape
                newRegion.remove();
                this.resetToolEvents();
                document.removeEventListener('keyup', onCancel);
                return false;
            }
            return null;
        }.bind(this);
        let onRegionDraw = function(event) {
            newRegion.polygonPath.segments[1].point.y = event.point.y;
            newRegion.polygonPath.segments[2].point.x = event.point.x;
            newRegion.polygonPath.segments[2].point.y = event.point.y;
            newRegion.polygonPath.segments[3].point.x = event.point.x;
        }.bind(this);
        
        this.tool.onMouseDown = function(event) {
            this.finishRegion(newRegion);
            document.removeEventListener('keyup', onCancel);
        }.bind(this);
        this.tool.onMouseMove = onRegionDraw;
        this.tool.onMouseDrag = function(event) {
            this.tool.onMouseUp = function(event) {
                this.finishRegion(newRegion);
                document.removeEventListener('keyup', onCancel);
            }.bind(this);
            onRegionDraw(event);
        }.bind(this);
        document.addEventListener('keyup', onCancel);
    }
    
    startCuter(event) {
        // rectangle cutter
        let clip = this.makeSelectionRectangle(event);
        let onCancel = function(event) {
            if (event.keyCode == 27) {  // escape
                clip.remove();
                this.resetToolEvents();
                document.removeEventListener('keyup', onCancel);
                return false;
            }
            return null;
        }.bind(this);

        this.tool.onMouseDrag = function(event) {
            this.updateSelectionRectangle(clip, event);
            this.splitHelper(clip, event);
        }.bind(this);
        this.tool.onMouseUp = function(event) {
            this.splitByPath(clip);
            clip.remove();
            this.resetToolEvents();
            document.removeEventListener('keyup', onCancel);
        }.bind(this);
        document.addEventListener('keyup', onCancel);
    }
    
    startLassoSelection(event) {
        let clip = this.makeSelectionRectangle(event);
        let onCancel = function(event) {
            if (event.keyCode == 27) {  // escape
                clip.remove();
                this.purgeSelection();
                this.resetToolEvents();
                document.removeEventListener('keyup', onCancel);
                return false;
            }
            return null;
        }.bind(this);
        this.tool.onMouseDrag = function(event) {
            this.updateSelectionRectangle(clip, event);
            this.lassoSelection(clip);
        }.bind(this);
        this.tool.onMouseUp = function(event) {
            clip.remove();
            this.resetToolEvents();
            document.removeEventListener('keyup', onCancel);
        }.bind(this);
        document.addEventListener('keyup', onCancel);
    }
    
    movePointInView(point, delta) {
        point.x += delta.x;
        point.y += delta.y;
        if (point.x < 0) point.x = 0;
        if (point.x > this.img.naturalWidth) point.x = this.img.naturalWidth;
        if (point.y < 0) point.y = 0;
        if (point.y > this.img.naturalHeight) point.y = this.img.naturalHeight;
    }
    
    reset() {
        // clean everything from the view
        for (let i=this.lines.length-1; i >= 0; i--) {
            this.lines[i].remove();
        };
        for (let i=this.regions.length-1; i >= 0; i--) {
            this.regions[i].remove();
        };
        this.lines = [];
        this.regions = [];
    }
    
    refresh() {
        let bounds = this.img.getBoundingClientRect();
        this.imgRatio = bounds.width / this.img.naturalWidth;
        if (paper.view) {
            this.deletePointBtn.style.display = 'none';
            paper.view.viewSize = [bounds.width, bounds.height];
            paper.view.scale(this.imgRatio/paper.view.zoom, [0, 0]);
        }
    }
    
    load(data) {
        /* Loads a list of lines containing each a baseline polygon and a mask polygon
         * [{baseline: [[x1, y1], [x2, y2], ..], mask:[[x1, y1], [x2, y2], ]}, {..}] */
        if (data.lines) {
            data.lines.forEach(function(line) {
                let context = {};
                if (this.idField) context[this.idField] = line[this.idField];
                if (!line.baseline) this.toggleMasks(true);
                let newLine = this.createLine(line.baseline, line.mask, context);
                if (!newLine.mask) newLine.createMask();
            }.bind(this));
        }
        if (data.regions) {   
            data.regions.forEach(function(region) {
                let context = {};
                if (this.idField) context[this.idField] = region[this.idField];
                let newRegion = this.createRegion(region.box, context);
            }.bind(this));
        }
    }
    
    exportJSON() {
        /* Returns a list of lines containing each a baseline polygon and a mask polygon
         * {
              regions: [[[xr1, yr1], [xr2, yr2], [xr3, yr3]], [..]],
              lines:[{baseline: [[x1, y1], [x2, y2], ..], mask:[[x1, y1], [x2, y2], ]}, {..}] 
           }
        */
        return {
            regions: this.regions.map(region => region.polygon),
            lines: this.lines.map(function(line) {
                return {
                    baseline: line.baseline,
                    mask: line.mask
                };
            }.bind(this))
        };
    }

    loadNextState() {
        if (this.stateIndex >= this.states.length -1) return;
        this.stateIndex++;
        this.loadState(this.stateIndex);        
    }
    
    loadPreviousState() {
        if (this.stateIndex == 0) return;
        this.stateIndex--;
        this.loadState(this.stateIndex);
    }
    
    loadState(index) {
        if (index === undefined) return;
        this.reset();
        this.load(this.states[this.stateIndex]);

        if (this.stateIndex > 0) this.undoBtn.disabled = false;
        else this.undoBtn.disabled = true;
        if (this.stateIndex < this.states.length-1) this.redoBtn.disabled = false;
        else this.redoBtn.disabled = true;
    }
    
    addState() {
        if (this.stateIndex < this.maxStates) this.stateIndex++;
        else this.states = this.states.slice(1);
        this.states = this.states.slice(0, this.stateIndex); // cut the state branch
        this.states[this.stateIndex] = this.exportJSON();
        if (this.stateIndex > 0 && this.undoBtn) this.undoBtn.disabled = false;
    }

    trigger(eventName, data) {
        var event = new CustomEvent(eventName, {detail:data});
        this.events.dispatchEvent(event);
    }
    
    updateLinesFromCanvas() {
        var changes = [];
        for (let i in this.lines) {
            if (this.lines[i].changed) {
                this.lines[i].updateDataFromCanvas();
                this.lines[i].changed = false;
                changes.push(this.lines[i]);
            }
        }
        if (changes.length) this.trigger('baseline-editor:update', {lines: changes});
        return changes;
    }
    
    updateRegionsFromCanvas() {
        var changes = [];
        for (let i in this.regions) {
            if (this.regions[i].changed) {
                this.regions[i].updateDataFromCanvas();
                this.regions[i].changed = false;
                changes.push(this.regions[i]);
            }
        }
        if (changes.length) this.trigger('baseline-editor:update', {regions: changes});
        return changes;
    }
    
    toggleMasks(force) {
        this.showMasks = force || !this.showMasks;
        if (this.showMasks) {
            this.toggleMasksBtn.classList.add('btn-success');
            this.toggleMasksBtn.classList.remove('btn-info');
        } else {
            this.toggleMasksBtn.classList.add('btn-info');
            this.toggleMasksBtn.classList.remove('btn-success');
        }
        for (let i in this.lines) {
            let poly = this.lines[i].maskPath;
            poly.visible = this.showMasks;
            // paperjs shows handles for invisible items :(
            // TODO: use layers?
            if (!poly.visible && poly.selected) poly.selected = false;
            if (poly.visible && this.lines[i].selected) poly.selected = true;
        }
    }

    toggleRegionMode() {
        this.purgeSelection();
        this.mode = this.mode == 'lines' ? 'regions' : 'lines';
        this.toggleRegionModeBtn.classList.toggle('btn-info');
        this.toggleRegionModeBtn.classList.toggle('btn-success');
        this.regions.forEach(function(region) {
            if (this.mode == 'lines') {
                region.polygonPath.fillColor = null;
            } else {
                region.polygonPath.fillColor = this.secondaryColor;
            }
        }.bind(this));
    }
    
    showContextMenu() {
        this.deleteSelectionBtn.style.display = 'inline';
        this.contextMenu.style.display = 'block';
        if (this.mode == 'lines' && this.selection.length > 1) {
            // we can only merge if all lines contain a baseline
            if (this.selection.filter(sel => sel.baselinePath === null).length > 0) {
                 this.mergeBtn.style.display = 'block';
            }
        }
        else this.mergeBtn.style.display = 'none';
    }
    hideContextMenu() {
        this.contextMenu.style.display = 'none';
    }
    
    addToSelection(obj) {
        if (this.selection.indexOf(obj) == -1) this.selection.push(obj);
        this.showContextMenu();
    }
    removeFromSelection(obj) {
        this.selection.splice(this.selection.indexOf(obj), 1);
        this.deletePointBtn.style.display = 'none';
        if (this.selection.length == 0) this.hideContextMenu();
        if (this.selection.length < 2) this.mergeBtn.style.display = 'none';
    }
    purgeSelection(except) {
        for (let i=this.selection.length-1; i >= 0; i--) {
            if (!except || except != this.selection[i]) {
                this.selection[i].unselect();
            }
        }
    }
    
    makeSelectionRectangle(event) {
        let shape = new Rectangle([event.point.x, event.point.y], [1, 1]);
        var clip = new Path.Rectangle(shape, 0);
        clip.opacity = 1;
        clip.strokeWidth = 2;
        clip.strokeColor = 'grey';
        clip.dashArray = [10, 4];
        clip.originalPoint = event.point;
        return clip;
    }

    updateSelectionRectangle(clip, event) {
        clip.bounds.width = Math.max(1, Math.abs(clip.originalPoint.x - event.point.x));
        if (event.point.x > clip.originalPoint.x) {
            clip.bounds.x = clip.originalPoint.x;
        } else {
            clip.bounds.x = event.point.x;
        }
        clip.bounds.height = Math.max(1, Math.abs(clip.originalPoint.y - event.point.y));
        if (event.point.y > clip.originalPoint.y) {
            clip.bounds.y = clip.originalPoint.y;
        } else {
            clip.bounds.y = event.point.y;
        }
    }
    
    lassoSelection(clip) {
        // draws a rectangle lasso selection tool that selects every line it crosses
        for (let i in this.lines) {
            let line = this.lines[i];
            if (line.selected) {continue;}  // avoid calculs
            if (line.baselinePath && (
                  clip.intersects(line.baselinePath) ||
                  line.baselinePath.isInside(clip.bounds))) {
                line.select();
            }
        }
    }
    
    splitHelper(clip, event) {
        this.lines.forEach(function(line) {
            if (!line.baselinePath) return;
            let intersections = line.baselinePath.getIntersections(clip);
            for (var i = 0; i < intersections.length; i++) {
                new Path.Circle({
                    center: intersections[i].point,
                    radius: 5,
                    fillColor: 'red'
                }).removeOnDrag().removeOnUp();

                if (intersections.length) {
                    // show what is going to be cut
                    let cut = new Path({strokeColor: 'red', strokeWidth: 2}).removeOnDrag().removeOnUp();
                    intersections.forEach(location => cut.add(location));
                    cut.bringToFront();
                    path.segments.forEach(function(segment) {
                        if (clip.contains(segment.point)) {
                            cut.insert(segment.index, segment);
                        }
                    }.bind(this));
                }
            }
        }.bind(this));
    }
    
    splitByPath(path) {
        this.lines.forEach(function(line) {
            if (!line.baselinePath) return;
            let intersections = line.baselinePath.getIntersections(path);
            for (var i = 0; i < intersections.length; i += 2) {
                if (i+1 >= intersections.length) {  // one intersection remaining
                    // remove everything in the selection rectangle
                    let location = intersections[i];
                    let newSegment = line.baselinePath.insert(location.index+1, location);
                    if (path.contains(line.baselinePath.firstSegment.point)) {
                        line.baselinePath.removeSegments(0, newSegment.index);
                    } else if (path.contains(line.baselinePath.lastSegment.point)) {
                        line.baselinePath.removeSegments(newSegment.index+1);
                    }
                    line.baselinePath.smooth({ type: 'catmull-rom', 'factor': 0.2 });
                    line.createPolygonEdgeForBaselineSegment(newSegment);
                    line.updateDataFromCanvas();
                } else {
                    let newLine = line.baselinePath.splitAt(intersections[i+1]);
                    let nl = this.createLine(newLine);
                    let trash = line.baselinePath.splitAt(intersections[i]);
                    line.maskPath.removeSegments();
                    line.createMask();
                    nl.createMask();
                    line = nl;
                    trash.remove();
                }
            }
            if (i) this.addState();  // if there was any changes, save them
        }.bind(this));
    }
    
    mergeSelection() {
        /* strategy is:
          1) order the lines by their position,
             line direction doesn't matter since .join() can merge from start or end points
          2) join the lines 2 by 2 setting tolerance to the shortest distance between
             the starting and ending points of both lines.
          3) Delete the left over
        */

        if (this.selection.filter(sel => sel.baselinePath !== null).length > 0) {
            return;
        }
        
        this.selection.sort(function(first, second) {
            let vector = first.baselinePath.segments[1].point.subtract(first.baselinePath.firstSegment.point);
            let rightToLeft = Math.cos(vector.angle/180*Math.PI) < 0;  // right to left
            // if (vertical) return first.baselinePath.position.y - second.baselinePath.position.y; // td
            if (rightToLeft) return second.baselinePath.position.x - first.baselinePath.position.x;
            else return first.baselinePath.position.x - second.baselinePath.position.x;
        });
        
        while (this.selection.length > 1) {
            let seg1 = this.selection[0].baselinePath.getNearestLocation(this.selection[1].baselinePath.interiorPoint);
            let seg2 = this.selection[1].baselinePath.getNearestLocation(this.selection[0].baselinePath.interiorPoint);
            this.selection[0].baselinePath.add(seg2);
            this.selection[0].baselinePath.join(this.selection[1].baselinePath, seg1.point.getDistance(seg2.point));
            
            for (let i in this.selection[1].maskPath.segments) {
                // Note: document advertise it's possible to insert more at once but couldn't make it work
                let insertAt = seg1.segment.index + parseInt(i) + 1;
                this.selection[0].maskPath.insert(insertAt, this.selection[1].maskPath.segments[i]);
            }
            
            this.selection[1].delete();
        }
        if (this.selection.length) {
            this.selection[0].updateDataFromCanvas();
            this.addState();
        }
    }

    setCursor(style) {
        if (style) {
            this.canvas.style.cursor = style;
        } else {
            this.canvas.style.cursor = this.spliting?'crosshair':'copy';
        }
    }
    
    setColors() {
        // Attempt to choose the best color for highlighting
        
        function isGrey_(color) {
            return (
                Math.abs(color[0] - color[1]) < 30 &&
                Math.abs(color[0] - color[2]) < 30 &&
                Math.abs(color[1] - color[2]) < 30
            );
        }
        
        function hasColor_(pal, channel) {
            for (let i in pal) {
                if (isGrey_(pal[i])) {continue;}
                if (pal[i][channel] == Math.max.apply(null, pal[i]) && pal[i][channel] > 100) {
                    // the channel is dominant in this color
                    return true;
                }
            }
            return false;
        }
        
        function chooseColors(pal, depth=0) {
            if (hasColor_(pal, 2)) {
                // has blue
                if (hasColor_(pal, 0)) {
                    // has red
                    if (hasColor_(pal, 1)) {
                        // has green; the document is quite rich, start again with only the 2 main colors
                        pal = pal.slice(0, 2);
                        if (depth < 1) return chooseColors(pal, depth=depth+1);
                        else return ['blue', 'teal']; // give up
                    } else {
                        return ['green', 'yellow'];
                    }
                } else {
                    return ['red', 'orange'];
                }
            } else {
                return ['blue', 'teal'];
            }
        }
        
        const rgbToHex = (c) => '#' + [c[0], c[1], c[2]]
              .map(x => x.toString(16).padStart(2, '0')).join('');

        if (ColorThief !== undefined && !this.mainColor) {
            var colorThief = new ColorThief();
            let palette = colorThief.getPalette(this.img, 5);
            // for (let i in palette) {
            //     let el = document.getElementById('color'+i);
            //     el.style.backgroundColor = rgbToHex(palette[i]);
            //     el.style.padding = '10px';
            // }
            let choices = chooseColors(palette);
            this.mainColor = choices[0];
            this.secondaryColor = choices[1];
        } else {
            this.mainColor = 'blue';
            this.secondaryColor = 'teal';
        }
    }
}
