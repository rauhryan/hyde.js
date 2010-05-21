wmd_options = { autostart: false };

jQuery(function () {
	var view = new jQuery.View(jQuery('body'));
	var controller = new jQuery.Controller(view, {});
});

jQuery.extend({

	Editor : function (rawMarkdown) {
		var me = this;

		var listeners = [];

		this.addListener = function (list) {
			listeners.push(list);
		}

		this.markdown = rawMarkdown;

		var createDom = function (markdown) {
			// build the dom elements
			var form = document.createElement("form");
			jQuery(form).attr('id','wysiwym-form');
			var textarea = document.createElement("textarea");
			textarea.value = rawMarkdown;
   			jQuery(textarea).addClass('wysiwym-textarea');
           		form.appendChild(textarea);
			var cancelButton = jQuery('<a href="#" class="wysiwym-button" ><span>Cancel</span></a>')
				.click(function () {
					me.notifyCancelClicked();
				});

			form.appendChild(cancelButton[0]);

			var saveButton = jQuery('<a href="#" class="wysiwym-button" ><span>Save</span></a>')
				.click(function () {
					me.notifySaveClicked(textarea.value);
				});

			form.appendChild(saveButton[0]);
	          	var previewDiv = document.createElement("div");
			jQuery(previewDiv).addClass('wysiwym-preview');
           		form.appendChild(previewDiv);

		
		
			me.form = jQuery(form);	

	    		return me.form;
		}

		var wireUpEditor = function (element) {
			// bind to the editor
			// build the preview manage
            		var panes = {input:jQuery('.wysiwym-textarea')[0], preview:jQuery('.wysiwym-preview')[0], output:null};
            		var previewManager = new Attacklab.wmd.previewManager(panes);
        
        	   	//  build the editor and tell it to refresh the preview after commands 
       		     	var editor = new Attacklab.wmd.editor(jQuery('.wysiwym-textarea')[0],previewManager.refresh);
			me.editor = editor;
			me.previewManager = previewManager;
			me.dom = element;
        	}

		this.destroy = function (){
			me.editor.destroy();
			me.previewManager.destroy();
			me.dom.remove();
		}

		this.prependTo = function ($element) {
			var dom = createDom();
			$element.prepend(dom);
			wireUpEditor(dom);
		}

		this.notifyCancelClicked = function () {
			jQuery.each(listeners, function (i) {
				listeners[i].cancelClicked();
			});
		}

		this.notifySaveClicked = function (newMarkdown) {
			jQuery.each(listeners, function (i) {
				listeners[i].saveClicked(newMarkdown);
			});
		}

	},
	View : function ($appendTo) {
		var me = this;

		var listeners = [];

		this.addListener = function (list) {
			listeners.push(list);
		}

		this.converter = new Showdown.converter();

		this.showView = function () {
			jQuery('#wysiwym-output-placeholder').show();
	
		}

		this.hideView = function () {
			jQuery('#wysiwym-output-placeholder').hide();
		}

		this.destroyView = function () {
			jQuery('#wysiwym-output').html('');

		}

		this.renderView = function (markdown) {
			var html = me.converter.makeHtml(markdown);
			jQuery('#wysiwym-output').html(html);
		}

		this.showEditor = function (rawMarkdown) {
			var editor = new jQuery.Editor(rawMarkdown);
			editor.prependTo(jQuery('body'));
			jQuery.each(listeners, function (i) {
				editor.addListener(listeners[i]);
			});
			this.editor = editor;
		}

		this.destroyEditor = function () {
			me.editor.destroy();
		}

		var createDom = function () {
			var placeholder = jQuery('<div id="wysiwym-output-placeholder" >')
			var editButton = jQuery('<a href="#edit-mode" id="wysiwym-edit-button" class="wysiwym-button" ><span>Edit</span></a>');
		        editButton.click(function () {
				me.notifyEditClicked();
			});

			placeholder.append(editButton);
			placeholder.append('<div id="wysiwym-output" >');
			return placeholder;	
		}

		$appendTo.append(createDom);

		this.notifyEditClicked = function () {
			jQuery.each(listeners, function (i) {
				listeners[i].editClicked();
			});
		}
		
		this.notifyCancelClicked = function () {
			jQuery.each(listeners, function (i) {
				listeners[i].cancelClicked();
			});
		}

		this.notifySaveClicked = function (newMarkdown) {
			jQuery.each(listeners, function (i) {
				listeners[i].saveClicked(newMarkdown);
			});
		}
	},
	ViewListener : function(list) {
		if(!list) list = {};
		return jQuery.extend({
			editClicked : function (){},
			cancelClicked : function (){},
			saveClicked : function (newMarkdown) {}
		}, list);
	},
	Controller : function (view, model) {
		
		var vlist = jQuery.ViewListener({
			editClicked : function () {
				view.hideView();
				view.showEditor(me.model.rawMarkdown);
			},
			cancelClicked : function () {
				view.destroyEditor();
				view.showView();
			},
			saveClicked : function (newMarkdown) {
				me.model.rawMarkdown = newMarkdown;
				view.destroyEditor();
				view.destroyView();
				view.renderView(liquify(me.model.rawMarkdown, me.model.templateData));
				view.showView();
			}
		});
		
		view.addListener(vlist);

		var me = this;
		this.defaults = {
			templateData : {title: 'Wysiwym', description: '"what you see is what you mean"'},
			rawMarkdown : '## {{ title }} \n \n --- \n {{ description }}'
		};

		this.model = jQuery.extend({}, me.defaults, model);

		var liquify = function (template, data){
			var tmpl = Liquid.parse( template );
			var content = tmpl.render( data );
			return content;
		}

		view.renderView(liquify(me.model.rawMarkdown, me.model.templateData));
	}
		       
});
