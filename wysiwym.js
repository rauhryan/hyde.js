wmd_options = { autostart: false };

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
		var panes = {input:textarea[0], preview:preview[0], output:function (output) { alert(output); }};
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
        
           
	    return $j(form);
		
	}
	var destroyInstance = function () {
		var instance = me.instances.pop();

		if(instance) {
			instance.Editor.destroy();
			instance.PreviewManager.destroy();
			instance.Form.remove();
		}

	}
	/* Public so you can override it */
	this.appendToBody = function (form){
		$j('body').append(form);
	}	

	var loadEditor = function (rawMarkdown){
		//var instance = createInstance(rawMarkdown);
		var instance = createDom(rawMarkdown);
		me.appendToBody(instance);
		
		/***** build the preview manager *****/
            	var panes = {input:$j('.wysiwym-textarea')[0], preview:$j('.wysiwym-preview')[0], output:null};
            	var previewManager = new Attacklab.wmd.previewManager(panes);
        
           	/***** build the editor and tell it to refresh the preview after commands *****/
            	var editor = new Attacklab.wmd.editor($j('.wysiwym-textarea')[0],previewManager.refresh);
        
            	// save everything so we can destroy it all later
            	me.instances.push({Form:$j('#wysiwym-form')[0], Editor:editor, PreviewManager:previewManager});
	}
	return {
		 create : loadEditor,
		 destroy : destroyInstance
	}
}

$j(function () {
	var wysiwym = new Wysiwym();
	wysiwym.create('** hi ');

});
