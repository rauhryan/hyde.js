wmd_options = { autostart: false };
/*
var Wysiwym = function () {
	var me = this;
	var checkLoaded = function () {
		return (Attacklab && Attacklab.wmd);
	}
	this.instances = [];

	 var createInstance = function (rawMarkdown) {
		if(!checkLoaded()){
			return;
		}
	
		var form = $j('<form id="wysiwym-form" >');
		var textarea = $j('<textarea class="wysiwym-textarea" >');
		textarea.html(rawMarkdown);
		form.append(textarea);

		var preview = $j('<div class="wysiwym-preview" >');
		form.append(preview);
		var panes = {input:textarea[0], preview:preview[0], output:null};
		var previewManager = new Attacklab.wmd.previewManager(panes);

		var editor = new Attacklab.wmd.editor(textarea[0], previewManager.refresh);

		instances.push({Form: form, Editor: editor, PreviewManager: previewManager});
		return form;				
	}
	var createDom = function (rawMarkdown) {
		// build the dom elements
		var form = document.createElement("form");
		$j(form).attr('id','wysiwym-form');
		var textarea = document.createElement("textarea");
		textarea.value = rawMarkdown;
   		$j(textarea).addClass('wysiwym-textarea');
           	form.appendChild(textarea);
          	 var previewDiv = document.createElement("div");
	   	$j(previewDiv).addClass('wysiwym-preview');
           	form.appendChild(previewDiv);
	    	
		
		me.form = $j(form);	

	    	return me.form;
		
	}
	var destroyInstance = function () {
		var instance = me.instances.pop();

		if(instance) {
			instance.Editor.destroy();
			instance.PreviewManager.destroy();
			instance.Form.remove();
		}

	}
	// Public so you can override it 
	this.appendToBody = function (form){
		$j('body').prepend(form);
		
		var button = $j('<a href="#open" class="minibutton" ><span>Open</span></a>');
		button.bind({
			focus: function () {		
				jQuery(this).addClass('mousedown');
			},
			blur: function () {
				jQuery(this).removeClass('mousedown');
			},
			mouseup: function () {
				jQuery(this).removeClass('mousedown');
			}

		});

		button.click(function () {
					me.form.toggle();
				});

		me.form.before(button);
	}	

	var loadEditor = function (rawMarkdown){
		//var instance = createInstance(rawMarkdown);
		var instance = createDom(rawMarkdown);
		me.appendToBody(instance);
		
		// build the preview manage
            	var panes = {input:$j('.wysiwym-textarea')[0], preview:$j('.wysiwym-preview')[0], output:null};
            	var previewManager = new Attacklab.wmd.previewManager(panes);
        
           	//  build the editor and tell it to refresh the preview after commands 
            	var editor = new Attacklab.wmd.editor($j('.wysiwym-textarea')[0],previewManager.refresh);
        
            	// save everything so we can destroy it all later
            	me.instances.push({Form:$j('#wysiwym-form')[0], Editor:editor, PreviewManager:previewManager});
	}
	return {
		 create : loadEditor,
		 destroy : destroyInstance
	}
}
*/

$j(function () {
	var view = new $j.View($j('body'));
	var controller = new $j.Controller(view, {});
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
			$j(form).attr('id','wysiwym-form');
			var textarea = document.createElement("textarea");
			textarea.value = rawMarkdown;
   			$j(textarea).addClass('wysiwym-textarea');
           		form.appendChild(textarea);
	          	var previewDiv = document.createElement("div");
			$j(previewDiv).addClass('wysiwym-preview');
           		form.appendChild(previewDiv);
	    	
		
			me.form = $j(form);	

	    		return me.form;
		}

		var wireUpEditor = function (element) {
			// bind to the editor
		}

		this.prependTo = function ($element) {
			$element.prepend(createDom(),wireUpEditor);
		}

	},
	View : function ($appendTo) {
		var me = this;

		var listeners = [];

		this.addListener = function (list) {
			listeners.push(list);
		}

		this.showView = function () {
	
		}

		this.hideView = function () {

		}

		this.destroyView = function () {

		}

		this.renderView = function () {

		}

		this.showEditor = function () {

		}

		this.destroyEditor = function () {

		}

		var createDom = function () {
			var placeholder = jQuery('<div id="wysiwym-output-placeholder" >')
			var editButton = jQuery('<a href="#edit-mode" id="wysiwym-edit-button" class="wysiwym-button" ><span>Edit</span></a>');
		        editButton.click(function () {
				me.notifyEditClicked();
			});

			placeholder.append(editButton);
			placeholder.append('<div id="wysiwym-output" class="wysiwym-output" >');
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

			},
			cancelClicked : function () {

			},
			saveClicked : function () {

			}
		});
		
		view.addListener(vlist);

		var me = this;
		this.defaults = {
			templateData : {},
			rawMarkdown : ''
		};

		this.model = jQuery.extend({}, me.defaults, model);
	}
		       
});
