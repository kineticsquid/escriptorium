'use strict';

var API = {
    'document': '/api/documents/' + DOCUMENT_ID,
    'parts': '/api/documents/' + DOCUMENT_ID + '/parts/',
    'part': '/api/documents/' + DOCUMENT_ID + '/parts/{part_pk}/' 
};

Dropzone.autoDiscover = false;
var g_dragged = null;  // Note: chrome doesn't understand dataTransfer very well
var wz, lastSelected = null, viewing=null;
var boxMode = 'block', zoomMode = false, seeBlocks = true, seeLines = true;

class partCard {
    constructor(part) {
        this.pk = part.pk;
        this.name = part.name;
        this.title = part.title;
        this.typology = part.typology;
        this.image = part.image;
        this.bw_image = part.bw_image;
        this.thumbnail = part.thumbnail;
        this.workflow = part.workflow;
        this.progress = part.transcription_progress;
        this.locked = false;
        this.blocks = [];
        this.lines = [];
        this.ratio = null;

        this.api = API.part.replace('{part_pk}', this.pk);
        
        var $new = $('.card', '#card-template').clone();
        this.$element = $new;
        this.domElement = this.$element.get(0);

        this.selectButton = $('.js-card-select-hdl', $new);
        this.deleteButton = $('.js-card-delete', $new);
        this.dropAfter = $('.js-drop', '#card-template').clone();
        
        // fill template
        $new.attr('id', $new.attr('id').replace('{pk}', this.pk));
        $('img.card-img-top', $new).attr('data-src', this.thumbnail.uri);
        $('img.card-img-top', $new).attr('title', this.title);

        $new.attr('draggable', true);
        $('img', $new).attr('draggable', false);
        $('img', $new).attr('selectable', false);
        // disable dragging when over input because firefox gets confused
        $('input', this.$element).on('mouseover', $.proxy(function(ev) {
            this.$element.attr('draggable', false);
        }, this)).on('mouseout', $.proxy(function(ev) {
            this.$element.attr('draggable', true);
        }, this));
        
        // add to the dom
        $('#cards-container').append($new);
        $('#cards-container').append(this.dropAfter);
        this.domElement.scrollIntoView(false);

        // workflow icons & progress
        this.binarizedButton = $('.js-binarized', this.$element);
        this.segmentedButton = $('.js-segmented', this.$element);
        this.transcribeButton = $('.js-trans-progress', this.$element);
        this.progressBar = $('.progress-bar', this.transcribeButton);
        this.progressBar.css('width', this.progress + '%');
        this.progressBar.text(this.progress + '%');
        this.updateWorkflowIcons();
        this.binarizedButton.click($.proxy(function(ev) { this.showBW(); }, this));
        this.segmentedButton.click($.proxy(function(ev) { this.showSegmentation(); }, this));
        this.transcribeButton.click($.proxy(function(ev) {
            if (this.workflow['transcribe'] == 'done') {
                var url = TRANSCRIPTION_URL + this.pk + '/';
                window.location.assign(url);
            }
        }, this));
        
        this.index = $('.card', '#cards-container').index(this.$element);
        // save a reference to this object in the card dom element
        $new.data('partCard', this);
        
        // add the image element to the lazy loader
        imageObserver.observe($('img', $new).get(0));
        
        this.defaultColor = this.$element.css('color');
        
        //************* events **************
        this.selectButton.on('click', $.proxy(function(ev) {
            if (ev.shiftKey) {
                if (lastSelected) {
                    var cards = partCard.getRange(lastSelected.index, this.index);
                    cards.each(function(i, el) {
                        $(el).data('partCard').select();
                    });
                }
            } else {
                this.toggleSelect();
            }
        }, this));

        this.deleteButton.on('click', $.proxy(function(ev) {
            if (!confirm("Do you really want to delete this image?")) { return; }
            this.delete();
        }, this));
        
        this.$element.on('dblclick', $.proxy(function(ev) {
            this.toggleSelect();
        }, this));
        
        // drag'n'drop
        this.$element.on('dragstart', $.proxy(function(ev) {
            if (this.locked) return;
            ev.originalEvent.dataTransfer.setData("text/card-id", ev.target.id);
            g_dragged = ev.target.id;  // chrome gets confused with dataTransfer, so we use a global
            $('.js-drop').addClass('drop-target');
        }, this));
        this.$element.on('dragend', $.proxy(function(ev) {
            $('.js-drop').removeClass('drop-target');
        }, this));        
    }

    inQueue() {
        return ((this.workflow['binarize'] == 'pending' ||
                 this.workflow['segment'] == 'pending' ||
                 this.workflow['transcribe'] == 'pending') &&
                !this.working());
    }

    working() {
        return (this.workflow['binarize'] == 'ongoing' ||
                this.workflow['segment'] == 'ongoing' ||
                this.workflow['transcribe'] == 'ongoing');
    }
    
    updateWorkflowIcons() {
        var map = [['binarize', this.binarizedButton],
                   ['segment', this.segmentedButton],
                   ['transcribe', this.transcribeButton]];
        for (var i=0; i < map.length; i++) {
            var proc = map[i][0], btn = map[i][1];
            if (this.workflow[proc] == undefined) {
                btn.removeClass('pending').removeClass('ongoing').removeClass('error').removeClass('done');
                btn.attr('title', btn.data('title'));
            } else {
                btn.removeClass('pending').removeClass('ongoing').removeClass('error').removeClass('done');
                btn.addClass(this.workflow[proc]).show();
                btn.attr('title', btn.data('title') + ' ('+this.workflow[proc]+')');
            }            
        }
        
        if (this.workflow['binarize'] == 'ongoing' ||
            this.workflow['segment'] == 'ongoing' ||
            this.workflow['transcribe'] == 'ongoing') {
            this.lock();
        }
        
        if (this.inQueue() || this.working()) {
            this.lock();
        } else {
            this.unlock();
        }
        
        if (this.workflow['transcribe'] == 'done') {
            $('#nav-trans-tab').removeClass('disabled');
        }
    }
    
    select() {
        if (this.locked) return;
        lastSelected = this;
        this.$element.addClass('bg-dark');
        this.$element.css({'color': 'white'});
        $('i', this.selectButton).removeClass('fa-square');
        $('i', this.selectButton).addClass('fa-check-square');
        this.selected = true;
    }
    unselect() {
        lastSelected = null;
        this.$element.removeClass('bg-dark');
        this.$element.css({'color': this.defaultColor});
        $('i', this.selectButton).removeClass('fa-check-square');
        $('i', this.selectButton).addClass('fa-square');
        this.selected = false;
    }
    toggleSelect() {
        if (this.selected) this.unselect();
        else this.select();
    }

    lock() {
        this.locked = true;
        this.$element.addClass('locked');
        this.$element.attr('draggable', false);
    }
    unlock() {
        this.locked = false;
        this.$element.removeClass('locked');
        this.$element.attr('draggable', true);
    }
    
    moveTo(index, upload) {
        if (upload === undefined) upload = true;
        // store the previous index in case of error
        this.previousIndex = this.index;
        var target = $('#cards-container .js-drop')[index];
        this.$element.insertAfter(target);
        this.dropAfter.insertAfter(this.$element);  // drag the dropable zone with it
        if (this.previousIndex < index) { index--; }; // because the dragged card takes a room
        if (upload) {
            $.post(this.api + 'move/', {
                index: index
            }).done($.proxy(function(data){
                this.previousIndex = null;
                this.blocks = data.blocks;
                this.lines = data.lines;
            }, this)).fail($.proxy(function(data){
                this.moveTo(this.previousIndex, false);
                // show errors
                console.log('Something went wrong :(', data);
            }, this)).always($.proxy(function() {
                this.unlock();
            }, this));
        }
        this.index = index;
    }
    
    delete() {
        var posting = $.ajax({url:this.api, type: 'DELETE'})
            .done($.proxy(function(data) {
                this.dropAfter.remove();
                this.$element.remove();
            }, this))
            .fail($.proxy(function(xhr) {
                console.log("Couldn't delete part " + this.pk);
            }, this));
    }

    showBW() {
        // Note: have to recreate an image because webkit never really delete the boxes otherwise
        var $viewer = $('#viewer');
        $viewer.empty();
        if (!this.bw_image) {
            $.get(this.api, $.proxy(function(data) {
                Object.assign(this, data);
                var $img = $('<img id="viewer-img" width="100%" src="'+this.bw_image.uri+'"/>');
                $viewer.append($img);
            }, this));
        } else {
            var $img = $('<img id="viewer-img" width="100%" src="'+this.bw_image.uri+'"/>');
            $viewer.append($img);
        }
        viewing = {index: this.index, mode:'bw'};
        if (this.index == 0) { $('#viewer-prev').attr('disabled', true); }
        else { $('#viewer-prev').attr('disabled', false); }
        if (this.index >= $('#cards-container .card').length-1) { $('#viewer-next').attr('disabled', true); }
        else { $('#viewer-next').attr('disabled', false); }
        $('#viewer-create-line').hide();
        $('#viewer-binarization, #viewer-blocks-lines').hide();
        $('#viewer-segmentation').show();
        
        $('#viewer-img').on('load', $.proxy(function(ev) {
            $('#viewer-container').trigger('wheelzoom.refresh');
        }, this));
        
        $viewer.parent().show();
    }
    
    showBlocks() {
        Object.keys(this.blocks).forEach($.proxy(function(i) {
            new Box('block', this, this.blocks[i], this.ratio);
        }, this));
        if (!seeBlocks) $('.block-box').hide();
    }
    showLines() {
        Object.keys(this.lines).forEach($.proxy(function(i) {
            new Box('line', this, this.lines[i], this.ratio);
        }, this));
        if (!seeLines) $('.line-box').hide();
    }
    
    createBoxAtMousePos(ev, mode) {
        var $img = $('#viewer-img');
        var top_left_x = Math.max(0, ev.pageX - $img.offset().left) / this.ratio / wz.scale;
        var top_left_y = Math.max(0, ev.pageY - $img.offset().top) / this.ratio / wz.scale;
        var box = [
            top_left_x, top_left_y, top_left_x + 120/this.ratio/wz.scale, top_left_y + 80/this.ratio/wz.scale
        ];
        var block = null;
        if ($(ev.target).is('.block-box')) {
            block = $(ev.target).data('Box').pk;
        };
        var box_ = new Box(mode, this, {
            order: Object.keys(this.blocks).length,
            box: box,
            block: block}, this.ratio);
        box_.changed = true;  // makes sure it's saved
    }
    
    showSegmentation() {
        $.get(this.api, $.proxy(function(data) {
            Object.assign(this, data);
            update_(this);
        }, this));
        
        function update_(this_) {
            var $viewer = $('#viewer');
            $viewer.empty();
            var $img = $('<img id="viewer-img" width="100%" src="'+this_.image.uri+'"/>');
            $viewer.append($img);
            
            viewing = {index: this_.index, mode:'seg'};
            if (this_.index == 0) { $('#viewer-prev').attr('disabled', true); }
            else { $('#viewer-prev').attr('disabled', false); }
            if (this_.index >= $('#cards-container .card').length-1) {
                $('#viewer-next').attr('disabled', true);
            }
            else {
                $('#viewer-next').attr('disabled', false);
            }
            $('#viewer-create-line').show();
            if (this_.bw_image && this_.bw_image.uri) {
                $('#viewer-binarization').show();
            } else {
                $('#viewer-binarization').hide();
            }
            $('#viewer-blocks-lines').show();
            $('#viewer-segmentation').hide();
            
            $('#viewer-img').on('load', $.proxy(function(ev) {
                this_.ratio = $img.width() / this_.image.size[0];
                $('#viewer-container').trigger('wheelzoom.refresh');
                this_.showBlocks();
                this_.showLines();
            }, this_));
        }
        
        $('#viewer').parent().show();
    }

    static fromPk(pk) {
        return $('#image-card-'+pk).data('partCard');
    }
    static getRange(from_, to_) {
        var from, to;
        if (from_ < to_) from = from_, to = to_;
        else from = to_, to = from_;
        return $('#cards-container .card').slice(from, to+1);
    }
    static getSelectedPks() {
        var pks = [];
        $('#cards-container .card').each(function(i, el) {
            var ic = $(el).data('partCard');
            if (ic.selected) {
                pks.push(ic.pk);
            }
        });
        return pks;
    }
}

// TODO: choose colors based on average color of image
var colors = ['blue', 'green', 'cyan', 'indigo', 'purple', 'pink', 'orange', 'yellow', 'teal'];
class Box {
    constructor(type, part, obj, imgRatio) {
        this.type = type; // can be either block or line
        this.part = part;
        this.pk = obj.pk || null;
        this.updateApi();
        this.order = obj.order;
        this.block = this.part.blocks.find(function(block) {
            return block.pk == obj.block;
        });
        this.imgRatio = imgRatio;
        this.changed = false;
        this.click = {x: null, y:null};
        this.originalWidth = (obj.box[2] - obj.box[0]) * imgRatio;
        var $box = $('<div class="box '+this.type+'-box"> <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>'+(DEBUG?this.order:'')+'</div>');
        $box.css({'left': obj.box[0] * imgRatio,
                  'top': obj.box[1] * imgRatio,
                  'width': (obj.box[2] - obj.box[0]) * imgRatio,
                  'height': (obj.box[3] - obj.box[1]) * imgRatio});
        var color;
        if (this.type == 'block') {
            color = colors[this.order % colors.length];
            $box.css({backgroundColor: color});
        } else if (this.type == 'line') {
            if (this.block == null) { color = 'red'; }
            else { console.log(this.block); color = colors[this.block.order % colors.length]; }
            $box.css({border: '2px solid '+color});
        }
        $box.draggable({
            disabled: true,
            containment: 'parent',
            cursor: "grab",
            stop: $.proxy(function(ev) {
                this.changed = true;
                if (zoomMode) $('#viewer-container').trigger('wheelzoom.enable');
            }, this),
            // this is necessary because WheelZoom make it jquery-ui drag jump around
            start: $.proxy(function(event) {
                this.click.x = event.clientX;
                this.click.y = event.clientY;
                $('#viewer-container').trigger('wheelzoom.disable');
            }, this),
            drag: $.proxy(function(event, ui) {
                var original = ui.originalPosition;
                ui.position = {
                    left: (event.clientX - this.click.x + original.left) / wz.scale,
                    top:  (event.clientY - this.click.y + original.top ) / wz.scale
                };
            }, this)
        });
        $box.resizable({
            disabled: true,
            stop: $.proxy(function(ev) {
                this.changed = true;
                if (zoomMode) $('#viewer-container').trigger('wheelzoom.enable');
            }, this),
            start: function(ev) {
                $('#viewer-container').trigger('wheelzoom.disable');
            }
        });
        
        $box.data('Box', this);
        $box.appendTo($('#viewer'));
        this.$element = $box;
        // we need to keep references to be able to unbind it
        this.proxyUnselect = $.proxy(function(ev) {
            // click in the img doesn't unselect ?!
            if ($(ev.target).parents('#viewer').length) { return; }
            this.unselect();
        }, this);
        this.proxyKeyboard = $.proxy(this.keyboard, this);
        
        // select a new line
        if (this.pk === null) this.select();

        // avoid jquery-ui jumping
        $box.on('mousedown', function(ev) { ev.currentTarget.style.position = 'relative'; });
        $box.on('mouseup', function(ev) { ev.currentTarget.style.position = 'absolute'; });
        
        $box.click($.proxy(function(ev) {
            ev.stopPropagation();  // avoid bubbling to document that would trigger unselect
            this.select();
        }, this));

        $('.close', this.$element).click($.proxy(function(ev) {
            ev.stopPropagation();
            this.delete();
        }, this));
    }

    updateApi() {
        this.api = {
            list: this.part.api + this.type + 's' + '/'
        };
        if (this.pk) {
            this.api.detail = this.api.list + this.pk + '/';
        }
    }
    
    getBox() {
        var x1 = parseInt((this.$element.position().left) / wz.scale / this.imgRatio);
        var y1 = parseInt((this.$element.position().top) / wz.scale / this.imgRatio);
        var x2 = parseInt(((this.$element.position().left) / wz.scale + this.$element.width()) / this.imgRatio);
        var y2 = parseInt(((this.$element.position().top) / wz.scale + this.$element.height()) / this.imgRatio);
        return [x1, y1, x2, y2];
    }
    keyboard(ev) {
        if(!this.$element.is('.selected')) return;
        if (ev.keyCode == 46) {
            this.delete();
        }
        else if (ev.keyCode == 37) { this.$element.animate({'left': '-=1px'}); }
        else if (ev.keyCode == 38) { this.$element.animate({'top': '-=1px'}); }
        else if (ev.keyCode == 39) { this.$element.animate({'left': '+=1px'}); }
        else if (ev.keyCode == 40) { this.$element.animate({'top': '+=1px'}); }
    }
    select() {
        if (this.$element.is('.selected')) return;
        var previous = $('.box.selected');
        if (previous.length) { previous.data('Box').unselect(); }
        this.$element.addClass('selected');
        this.$element.draggable('enable');
        this.$element.resizable('enable');
        $(document).on('click', this.proxyUnselect);
        $(document).on('keyup', this.proxyKeyboard);
    }
    unselect() {
        $(document).off('keyup', this.proxykeyboard);
        $(document).off('click', this.proxyUnselect);
        this.$element.removeClass('selected');
        this.$element.draggable('disable');
        this.$element.resizable('disable');
        if (this.changed) {
            this.upload();
        }
    }
    
    upload() {
        var post = {};
        post = { document_part: this.part.pk,
                 box: JSON.stringify(this.getBox()) };
        if (this.type == 'line') post.block = this.block.pk;
        var uri = this.pk?this.api.detail:this.api.list;
        var type = this.pk?'PUT':'POST';
        $.ajax({url: uri, type: type, data: post})
            .done($.proxy(function(data) {
                this.pk = data.pk;
                this.updateApi();
            }, this)).fail(function(data){
                alert("Couldn't save block:", data);
            });
        this.changed = false;
    }
    delete() {
        if (!confirm("Do you really want to delete this line?")) { return; }
        if (this.pk !== null) {
            $.ajax({url: this.api.detail, type:'DELETE'});
        }
        $(document).unbind('keyup', this.proxykeyboard);
        $(document).off('click', this.proxyUnselect);
        this.$element.unbind();
        this.$element.remove();
    }
}

$(document).ready(function() {
    //************* Card ordering *************
    $('#cards-container').on('dragover', '.js-drop', function(ev) {
        var index = $('#cards-container .js-drop').index(ev.target);
        var elementId = ev.originalEvent.dataTransfer.getData("text/card-id");
        if (!elementId && g_dragged != null) { elementId = g_dragged; }  // for chrome
        var dragged_index = $('#cards-container .card').index(document.getElementById(elementId));
        var isCard = ev.originalEvent.dataTransfer.types.indexOf("text/card-id") != -1;
        if (isCard && index != dragged_index && index != dragged_index + 1) {
            $(ev.target).addClass('drop-accept');
            ev.preventDefault();
        }
    });
    
    $('#cards-container').on('dragleave','.js-drop', function(ev) {
        ev.preventDefault();
        $(ev.target).removeClass('drop-accept');
    });
    
    $('#cards-container').on('drop', '.js-drop', function(ev) {
        ev.preventDefault();
        $(ev.target).removeClass('drop-accept');
        var elementId = ev.originalEvent.dataTransfer.getData("text/card-id");
        if (!elementId) { elementId = g_dragged; }  // for chrome
        var dragged = document.getElementById(elementId);
        var card = $(dragged).data('partCard');
        var index = $('#cards-container .js-drop').index(ev.target);
        card.moveTo(index);
        g_dragged = null;
    });

    // update workflow icons, send by notification through web socket
    $('#alerts-container').on('part:workflow', function(ev, data) {
        var card = partCard.fromPk(data.id);
        if (card) {
            card.workflow[data.process] = data.status;
            card.updateWorkflowIcons();
        } else {
            // we probably received the event before the card was created, retrigger ev in a sec
            setTimeout(function() {
                $('#alerts-container').trigger(ev, data);
            }, 1000);
        }
    });
    
    // create & configure dropzone
    var imageDropzone = new Dropzone('.dropzone', {
        paramName: "image",
        parallelUploads: 1  // ! important or the 'order' field gets duplicates
    });
    imageDropzone.on('sending', function(file, xhr, formData){
        formData.append('auto_process', $('#auto_process').get(0).checked);
    });
    
    //************* New card creation **************
    imageDropzone.on("success", function(file, data) {
        var card = new partCard(data);
        // cleanup the dropzone if previews are pilling up
        if (imageDropzone.files.length > 7) {  // a bit arbitrary, depends on the screen but oh well
            for (var i=0; i < imageDropzone.files.length - 7; i++) {
                if (imageDropzone.files[i].status == "success") {
                    imageDropzone.removeFile(imageDropzone.files[i]);
                }
            }
        }
    });
    
    // processor buttons
    $('#select-all').click(function(ev) {
        var cards = partCard.getRange(0, $('#cards-container .card').length);
        cards.each(function(i, el) {
            $(el).data('partCard').select();
        });
    });
    $('#unselect-all').click(function(ev) {
        var cards = partCard.getRange(0, $('#cards-container .card').length);
        cards.each(function(i, el) {
            $(el).data('partCard').unselect();
        });
    });
    
    $('.js-proc-selected').click(function(ev) {
        var proc = $(ev.target).data('proc');
        var selected_num = partCard.getSelectedPks().length;
        if(selected_num > 0) {
            // update selected count
            $('#selected-num', '#'+proc+'-wizard').text(selected_num);
            if (selected_num != 1) { $('#id_bw_image').attr('disabled', true); }
            else { $('#id_bw_image').attr('disabled', false); }
            
            // Reset the form
            $('.process-part-form', '#'+proc+'-wizard').get(0).reset();
            
            $('#'+proc+'-wizard').modal('show');
        } else {
            alert('Select at least one image.');
        }
    });
    $('.process-part-form').submit(function(ev) {
        ev.preventDefault();
        var $form = $(ev.target);
        var proc = $form.data('proc');
        $('input[name=parts]', $form).val(JSON.stringify(partCard.getSelectedPks()));
        $('#'+proc+'-wizard').modal('hide');
        $.ajax({
            url : $form.attr('action'),
            type: "POST",
            data : new FormData($form.get(0)),
            processData: false,
            contentType: false
        }).done(function(data) {
            console.log(proc+' process', data.status);
        }).fail(function(xhr) {
            var data = xhr.responseJSON;
            if (data.status == 'error') { alert(data.error); }
        });
    });
    
    // zoom
    wz = WheelZoom($('#viewer-container'), true, 1, null, null);
    function toggleZoom() {
        zoomMode = !zoomMode;
        $('#zoom-range').toggle();
        $('#viewer-zoom').toggleClass('btn-primary').toggleClass('btn-secondary');
        if (zoomMode) { $('#viewer-container').trigger('wheelzoom.enable'); }
        else { $('#viewer-container').trigger('wheelzoom.disable'); }
    }
    
    $('#viewer-zoom').click(function(ev) {
        toggleZoom();
    });
    $('#viewer-container').get(0).addEventListener('wheelzoom.update', function(ev) {
        $('#zoom-range').attr('min', wz.min_scale);
        $('#zoom-range').attr('max', wz.max_scale);
        $('#zoom-range').val(wz.scale);
    });
    $('#zoom-range').on('mousedown', function(ev) {
        $('#viewer-container').trigger('wheelzoom.disable');
    }).on('mouseup', function(ev) {
        if (zoomMode) {
            $('#viewer-container').trigger('wheelzoom.enable');
        }
    }).on('change', function(ev) {
        wz.scale = parseFloat($(ev.target).val());
        $('#viewer-container').trigger('wheelzoom.refresh');
    });

    // viewer buttons
    $('#viewer-prev').click(function(ev) {
        if (viewing && viewing.index > 0) {
            var card = $('#cards-container .card:eq('+(viewing.index-1)+')').data('partCard');
            if (viewing.mode == 'bw') { card.showBW(); }
            else if(viewing.mode == 'seg') { card.showSegmentation(); }
        }
    });
    $('#viewer-next').click(function(ev) {
        if (viewing && viewing.index < $('#cards-container .card').length) {
            var card = $('#cards-container .card:nth('+(viewing.index+1)+')').data('partCard');
            if (viewing.mode == 'bw') { card.showBW(); }
            else if(viewing.mode == 'seg') { card.showSegmentation(); }
        }
    });
    $('#viewer-reset').click(function(ev) {
        $('#viewer-container').trigger('wheelzoom.reset');
        $('#zoom-range').val(wz.scale);
    });
    $('#viewer-binarization').click(function(ev) {
        var card = $('#cards-container .card:eq('+(viewing.index)+')').data('partCard');
        if (viewing.mode != 'bw') { card.showBW(); }
    });
    $('#viewer-segmentation').click(function(ev) {
        var card = $('#cards-container .card:eq('+(viewing.index)+')').data('partCard');
        if(viewing.mode != 'seg') { card.showSegmentation(); }
    });
    $('#viewer-blocks').click(function(ev) {
        $('#viewer-blocks').toggleClass('btn-primary').toggleClass('btn-secondary');
        seeBlocks = !seeBlocks;
        if (seeBlocks) $('.block-box').show();
        else $('.block-box').hide();
    });
    $('#viewer-lines').click(function(ev) {
        $('#viewer-lines').toggleClass('btn-primary').toggleClass('btn-secondary');
        seeLines = !seeLines;
        if (seeLines) $('.line-box').show();
        else $('.line-box').hide();
    });
    $('#viewer-create-block').click(function(ev) {
        $('#viewer-create-line').removeClass('btn-success').addClass('btn-secondary');
        $('#viewer-create-block').removeClass('btn-secondary').addClass('btn-success');
        boxMode = 'block';
    });
    $('#viewer-create-line').click(function(ev) {
        $('#viewer-create-block').removeClass('btn-success').addClass('btn-secondary');
        $('#viewer-create-line').removeClass('btn-secondary').addClass('btn-success');
        boxMode = 'line';
    });
    $('#viewer').on('dblclick', function(ev) {
        var part = $('#cards-container .card:eq('+(viewing.index)+')').data('partCard');
        part.createBoxAtMousePos(ev, boxMode);
    });
    $('#viewer').on('dblclick', '.block-box', function(ev) {
        ev.stopPropagation();
        var part = $('#cards-container .card:eq('+(viewing.index)+')').data('partCard');
        part.createBoxAtMousePos(ev, 'line');
    });

    /* Keyboard Shortcuts */
    $(document).keydown(function(e) {
        if(e.originalEvent.ctrlKey && e.originalEvent.key == 'z') {
            toggleZoom();
        }
    });

    /* fetch the images and create the cards */
    var counter=0;
    var getNextParts = function(page) {
        var uri = API.parts + '?page=' + page;
        $.get(uri, function(data) {
            counter += data.results.length;            
            $('#loading-counter').html(counter+'/'+data.count);
            if (data.next) getNextParts(page+1);
            else { $('#loading-counter').parent().fadeOut(1000); }
            for (var i=0; i<data.results.length; i++) {
                new partCard(data.results[i]);
            }
        });
    };
    getNextParts(1);
});