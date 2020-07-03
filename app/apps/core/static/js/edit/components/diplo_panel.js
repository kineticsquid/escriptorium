var DiploPanel = BasePanel.extend({
    data() { return {
        editLine: null,
        save: false, //show save button
        updatedLines : [],
        createdLines : [],
        dragging: -1,
        lineDragged: null,
        movedLines:[],

    };},
    components: {
        'diploline': diploLine,
    },
    mounted(){
        Vue.nextTick(function() {
            var vm = this ;
             var el = document.getElementById('list');
             sortable = Sortable.create(el, {
                group: 'shared',
                multiDrag: true,
                multiDragKey : 'CTRL',
                selectedClass: "selected",
                animation: 150,
                onEnd: function(/**Event*/evt) {
                    vm.onEnd(evt);
                }

        });


        }.bind(this));



    },
    methods:{
        onEnd(ev) {
            for(let i=0; i< ev.newIndicies.length; i++){
                let line = ev.newIndicies[i];
                let pk = line.multiDragElement.querySelector('.line-content').id;
                let index = line.index;
                let elt = {"pk":pk, "index":index};
                this.movedLines.push(elt);
            }

            this.moveLines();
        },
        moveLines(){

            this.$parent.$emit('line:move',this.movedLines, function () {
                this.movedLines = [];
            }.bind(this));
        },
        toggleSave(){
            this.addToList();
            this.bulkUpdate();
            this.bulkCreate();
        },
        updateEditLine(position){
            if(position < this.part.lines.length && position >= 0) {
                this.setEditLine(this.part.lines[position]);
                let nextLine = this.$children[position];
                nextLine.startEdit();
            }
        },
        setHeight() {
            this.$el.querySelector('.content-container').style.maxHeight = Math.round(this.part.image.size[1] * this.ratio) + 'px';
        },
        onKeyDown(ev){
            let index = this.part.lines.indexOf(this.editLine);

            //disable shortcuts
            this.$parent.blockShortcuts = true;

            if(ev.keyCode==8 && this.getpositionCursor()==0){
                this.updateEditLine(index -1);
                let idx = this.part.lines.indexOf(this.editLine);
                for(let i=idx; i< this.$children.length; i++)
                {
                    let child = this.$children[i];
                    let nextLine = this.part.lines[i+1];
                    if(i == idx){
                        let content = child.line.currentTrans.content + nextLine.currentTrans.content;

                        child.setContent(content);
                    }
                    else if(nextLine){
                        child.setContent(nextLine.currentTrans.content);
                    }
                    else {
                        child.setContent("");
                    }
                    this.setpositionCursor("[id='"+ this.editLine.pk+ "']");
                }
                this.toggleSave();
            }

            if(ev.keyCode == 13){
                let idx = this.part.lines.indexOf(this.editLine) ;
                if(idx < this.part.lines.length -1){
                // this.updateEditLine(index +1);
                this.carriage(ev,idx);
                }
            }

        },

        setEditLine(l) {
            this.editLine = l;
        },
        bulkUpdate(){
            if(this.updatedLines.length){
                this.$parent.$emit(
                    'bulk_update:transcriptions',
                    this.updatedLines,
                    function () {
                        this.updatedLines = [];
                    }.bind(this));
            }
        },
        bulkCreate(){
            if(this.createdLines.length){
                this.$parent.$emit(
                    'bulk_create:transcriptions',
                    this.createdLines,
                    function () {
                        this.createdLines = [];
                    }.bind(this));
            }
        },
        addToList(){
            for(let i=0;i<this.$children.length; i++) {
                let currentLine = this.$children[i];
                if(currentLine.line.currentTrans.content != currentLine.$refs.content[0].textContent){
                    currentLine.line.currentTrans.content = currentLine.$refs.content[0].textContent ;
                    if(currentLine.line.currentTrans.pk)
                        this.addToUpdatedLines(currentLine.line.currentTrans);
                    else
                        this.createdLines.push(currentLine.line.currentTrans);
                }
            }
        },
        addToUpdatedLines(lt){
            let elt = this.updatedLines.find(l => l.pk === lt.pk);
            if(elt == undefined) {
                this.updatedLines.push(lt);
            } else {
                elt.content = lt.content;
                elt.version_updated_at = lt.version_updated_at;
            }
        },
        moveLine(from, to) {
            if (to === -1) {
                return 0;
            } else {
                this.part.lines.splice(to, 0,this.part.lines.splice(from, 1)[0]);
            }
        },
        updateView() {
            this.setHeight();
        },
        getpositionCursor() {
            return window.getSelection().getRangeAt(0).startOffset;
        },
        setpositionCursor(id) {
            const elt =  document.querySelector(id);
            const textNode = elt.childNodes[0];
            let  sel = window.getSelection();
            const range = document.createRange();
            range.setStart(textNode,textNode.length );  // Start at first character
            range.setEnd(textNode, textNode.length);
            sel.removeAllRanges();
            sel.addRange(range);
        },
        //return --> insert carriage return here and push rest of text of this line into the next line.
        // If there is text in the next line push that line one down etc. If there is no text in the next line dont push further
        carriage(ev,idx){
            ev.preventDefault();
            if (window.getSelection) {
                  var selection = window.getSelection(),
                  range = selection.getRangeAt(0),
                      br = document.createElement("br"),
                      textNode = document.createTextNode($("<div></div>").text()); //Passing " " directly will not end up being shown correctly
                  range.deleteContents();
                  range.insertNode(br);
                  range.collapse(false);
                  range.insertNode(textNode);
                  range.selectNodeContents(textNode);
                  selection.removeAllRanges();
                  selection.addRange(range);
                  let child = this.$children[idx+1];
                  let target = selection.anchorNode.nextSibling.parentNode ;
                  let html = target.innerHTML ;
                  let after_break = html.substring(html.indexOf('br')+3);

                  child.setContent(after_break + child.line.currentTrans.content);
                  target.innerHTML = html.substring(0, html.indexOf('<br')) + "</div>";
                  this.updateEditLine(idx+1);
                  return false;
            }

        }
    },

});
