var Liquid = {

  author: 'M@ McCray <darthapo@gmail.com>',
  version: '1.2.1',

  readTemplateFile: function(path) {
    throw ("This liquid context does not allow includes.");
  },

  registerFilters: function(filters) {
    Liquid.Template.registerFilter(filters);
  },

  parse: function(src) {
    return Liquid.Template.parse(src);
  }

}

Liquid.Tag = Class.create({

  initialize: function(tagName, markup, tokens) {
    this.tagName = tagName;
    this.markup = markup;
    this.nodelist = this.nodelist || [];
    this.parse(tokens);
  },

  parse: function(tokens) {
  },

  render: function(context) {
    return '';
  }

});
Liquid.Block = Class.create(Liquid.Tag, {

  initialize: function($super, tagName, markup, tokens){
    this.blockName = tagName;
    this.blockDelimiter = "end"+ this.blockName;
    $super(tagName, markup, tokens);
  },

  parse: function(tokens) {
    this.nodelist = this.nodelist || [];
    $A(this.nodelist).clear();
    var token = tokens.shift();
    tokens.push(''); // To ensure we don't lose the last token passed in...
    while(tokens.length) {

      if( /^\{\%/.test(token) ) { // It's a tag...
        var tagParts = token.match(/^\{\%\s*(\w+)\s*(.*)?\%\}$/);

        if(tagParts) {
          if( this.blockDelimiter == tagParts[1] ) {
            this.endTag();
            return;
          }
          if( tagParts[1] in Liquid.Template.tags ) {
            this.nodelist.push( new Liquid.Template.tags[tagParts[1]]( tagParts[1], tagParts[2], tokens ) );
          } else {
            this.unknownTag( tagParts[1], tagParts[2], tokens );
          }
        } else {
          throw ( "Tag '"+ token +"' was not properly terminated with: %}");
        }
      } else if(/^\{\{/.test(token)) { // It's a variable...
        this.nodelist.push( this.createVariable(token) );
      } else { //if(token != '') {
        this.nodelist.push( token );
      } // Ignores tokens that are empty
      token = tokens.shift(); // Assign the next token to loop again...
    }

    this.assertMissingDelimitation();
  },

  endTag: function() {},

  unknownTag: function(tag, params, tokens) {
    switch(tag) {
      case 'else': throw (this.blockName +" tag does not expect else tag"); break;
      case 'end':  throw ("'end' is not a valid delimiter for "+ this.blockName +" tags. use "+ this.blockDelimiter); break;
      default:     throw ("Unknown tag: "+ tag);
    }
  },

  createVariable: function(token) {
    var match = token.match(/^\{\{(.*)\}\}$/);
    if(match) { return new Liquid.Variable(match[1]); }
    else { throw ("Variable '"+ token +"' was not properly terminated with: }}"); }
  },

  render: function(context) {
    return this.renderAll(this.nodelist, context);
  },

  renderAll: function(list, context) {
    return $A(list || []).map(function(token, i){
      var output = '';
      try { // hmmm... feels a little heavy
        output = ( token['render'] ) ? token.render(context) : token;
      } catch(e) {
        output = context.handleError(e);
      }
      return output;
    });
  },

  assertMissingDelimitation: function(){
    throw (this.blockName +" tag was never closed");
  }
});
Liquid.Document = Class.create( Liquid.Block, {

  initialize: function(tokens){
    this.blockDelimiter = []; // [], really?
    this.parse(tokens);
  },

  assertMissingDelimitation: function() {
  }
});
Liquid.Strainer = Class.create({

  initialize: function(context) {
    this.context = context;
  },

  respondTo: function(methodName) {
    return (methodName in this);
  }
});

Liquid.Strainer.filters = $H({});

Liquid.Strainer.globalFilter = function(filters) {
  Liquid.Strainer.filters.update(filters);
  Liquid.Strainer.addMethods( filters );
}

Liquid.Strainer.requiredMethods = $A(['respondTo', 'context']);

Liquid.Strainer.create = function(context) {
  var strainer = new Liquid.Strainer(context);
  return strainer;
}

Liquid.Context = Class.create({

  initialize: function(assigns, registers, rethrowErrors) {
    this.scopes = [ $H(assigns || {}) ];
    this.registers = registers || {};
    this.errors = [];
    this.rethrowErrors = rethrowErrors;
    this.strainer = Liquid.Strainer.create(this);
  },

  get: function(varname) {
    return this.resolve(varname);
  },

  set: function(varname, value) {
    this.scopes[0].set(varname, value);
  },

  hasKey: function(key) {
    return (this.resolve(key)) ? true : false;
  },

  push: function() {
    var scpObj = $H({});
    this.scopes.unshift(scpObj);
    return scpObj // Is this right?
  },

  merge: function(newScope) {
    return this.scopes[0].update(newScope);
  },

  pop: function() {
    if(this.scopes.length == 1){ throw "Context stack error"; }
    return this.scopes.shift();
  },

  stack: function(lambda, bind) {
    var result = null;
    this.push();
    try {
      result = lambda.apply(bind || this.strainer);
    } finally {
      this.pop();
    }
    return result;
  },

  invoke: function(method, args) {
    if( this.strainer.respondTo(method) ) {
      var result = this.strainer[method].apply(this.strainer, args);
      return result;
    } else {
      return $A(args).first(); // was: $pick
    }
  },

  resolve: function(key) {
    switch(key) {
      case null:
      case 'nil':
      case 'null':
      case '':
        return null;

      case 'true':
        return true;

      case 'false':
        return false;

      case 'blank':
      case 'empty':
        return '';

      default:
        if((/^'(.*)'$/).test(key))      // Single quoted strings
          { return key.replace(/^'(.*)'$/, '$1'); }

        else if((/^"(.*)"$/).test(key)) // Double quoted strings
          { return key.replace(/^"(.*)"$/, '$1'); }

        else if((/^(\d+)$/).test(key)) // Integer...
          { return parseInt( key.replace(/^(\d+)$/ , '$1') ); }

        else if((/^(\d[\d\.]+)$/).test(key)) // Float...
          { return parseFloat( key.replace(/^(\d[\d\.]+)$/, '$1') ); }

        else if((/^\((\S+)\.\.(\S+)\)$/).test(key)) {// Ranges
          var range = key.match(/^\((\S+)\.\.(\S+)\)$/),
              left  = range[1],
              right = range[2];
              arr   = $R(left, right).toArray();
          return arr;

        } else {
          var result = this.variable(key);
          return result;
        }
    }
  },

  findVariable: function(key) {
    for (var i=0; i < this.scopes.length; i++) {
      var scope = this.scopes[i];
      if( scope && scope.keys().include(key) ) {
        var variable = scope.get(key);
        if(typeof(variable) == 'function'){
          variable = variable.apply(this);
          scope.set(key, variable);
        }
        if(variable && typeof(variable) == 'object' && ('toLiquid' in variable)) {
          variable = variable.toLiquid();
        }
        if(variable && typeof(variable) == 'object' && ('setContext' in variable)){
          variable.setContext(self);
        }
        return variable;
      }
    };
    return null;
  },

  variable: function(markup) {
    if(typeof markup != 'string') {
      return null;
    }

    var parts       = markup.match( /\[[^\]]+\]|(?:[\w\-]\??)+/g ),
        firstPart   = parts.shift(),
        squareMatch = firstPart.match(/^\[(.*)\]$/);

    if(squareMatch)
      { firstPart = this.resolve( squareMatch[1] ); }

    var object = this.findVariable(firstPart),
        self = this;

    if(object) {
      parts.each(function(part){
        var squareMatch = part.match(/^\[(.*)\]$/);
        if(squareMatch) {
          var part = self.resolve( squareMatch[1] );
          if( typeof(object[part]) == 'function'){ object[part] = object[part].apply(this); }// Array?
          object = object[part];
          if(typeof(object) == 'object' && ('toLiquid' in object)){ object = object.toLiquid(); }
        } else {
          if( (typeof(object) == 'object' || typeof(object) == 'hash') && (part in object)) {
            res = object[part];
            if( typeof(res) == 'function'){ res = object[part] = res.apply(self) ; }
            if( typeof(res) == 'object' && ('toLiquid' in res)){ object = res.toLiquid(); }
            else { object = res; }
          }
          else if( (/^\d+$/).test(part) ) {
            pos = parseInt(part);
            if( typeof(object[pos]) == 'function') { object[pos] = object[pos].apply(self); }
            if(typeof(object[pos]) == 'object' && typeof(object[pos]) == 'object' && ('toLiquid' in object[pos])) { object = object[pos].toLiquid(); }
            else { object  = object[pos]; }
          }
          else if( typeof(object[part]) == 'function' && ['length', 'size', 'first', 'last'].include(part) ) {
            object = object[part].apply(part);
            if('toLiquid' in object){ object = object.toLiquid(); }
          }
          else {
            return null;
          }
          if(typeof(object) == 'object' && ('setContext' in object)){ object.setContext(self); }
        }
      });
    }
    return object;
  },

  addFilters: function(filters) {
    filters = filters.flatten();
    filters.each(function(f){
      if(typeof(f) != 'object'){ throw ("Expected object but got: "+ typeof(f)) }
      this.strainer.addMethods(f);
    });
  },

  handleError: function(err) {
    this.errors.push(err);
    if(this.rethrowErrors){ throw err; }
    return "Liquid error: "+ (err.message || err.description || err);
  }

});
Liquid.Template = Class.create({

  initialize: function() {
    this.root = null;
    this.registers = $H({});
    this.assigns = $H({});
    this.errors = [];
    this.rethrowErrors = false;
    this.lastContext = null;
  },

  parse: function(src) {
    this.root = new Liquid.Document( Liquid.Template.tokenize(src) );
    return this;
  },

  render: function() {
    if(!this.root){ return ''; }
    var args = {
      ctx: arguments[0],
      filters: arguments[1],
      registers: arguments[2]
    }
    var context = null;

    if(args.ctx instanceof Liquid.Context ) {
      context = args.ctx;
      this.assigns = context.assigns;
      this.registers = context.registers;
    } else {
      if(args.ctx){ this.assigns.update(args.ctx); }
      if(args.registers){ this.registers.update(args.registers); }
      context = new Liquid.Context(this.assigns, this.registers, this.rethrowErrors)
    }

    if(args.filters){ context.addFilters(arg.filters); }

    try {
      return this.root.render(context).join('');
    } finally {
      this.errors = context.errors;
      this.lastContext = context;
    }
  },

  renderWithErrors: function() {
    this.renderWithErrors = true;
    return this.render.apply(this, arguments);
  }
});


Liquid.Template.tags = {};

Liquid.Template.registerTag = function(name, klass) {
  Liquid.Template.tags[ name ] = klass;
}

Liquid.Template.registerFilter = function(filters) {
  Liquid.Strainer.globalFilter(filters)
}

Liquid.Template.tokenize = function(src) {
  var tokens = src.split( /(\{\%.*?\%\}|\{\{.*?\}\}?)/ );
  if(tokens[0] == ''){ tokens.shift(); }
  return tokens;
}


Liquid.Template.parse =  function(src) {
  return (new Liquid.Template()).parse(src);
}
Liquid.Variable = Class.create({

  initialize: function(markup) {
    this.markup = markup;
    this.name = null;
    this.filters = [];
    var self = this;
    var match = markup.match(/\s*("[^"]+"|'[^']+'|[^\s,|]+)/);
    if( match ) {
      this.name = match[1];
      var filterMatches = markup.match(/\|\s*(.*)/);
      if(filterMatches) {
        var filters = filterMatches[1].split(/\|/);
        filters.each(function(f){
          var matches = f.match(/\s*(\w+)/);
          if(matches) {
            var filterName = matches[1];
            var filterArgs = []
            $A(f.match(/(?:[:|,]\s*)("[^"]+"|'[^']+'|[^\s,|]+)/g) || []).flatten().each(function(arg){
              var cleanupMatch = arg.match(/^[\s|:|,]*(.*?)[\s]*$/);
              if(cleanupMatch)
                { filterArgs.push( cleanupMatch[1] );}
            });
            self.filters.push( [filterName, filterArgs] );
          }
        });
      }
    }
  },

  render: function(context) {
    if(this.name == null){ return ''; }
    output = context.get(this.name);
    this.filters.each(function(filter) {
      var filterName = filter[0],
          filterArgs = $A(filter[1] || []).map(function(arg){
            return context.get(arg);
          });
      filterArgs.unshift(output); // Push in input value into the first argument spot...
      output = context.invoke(filterName, filterArgs );
    });

    return output;
  }
});
Liquid.Condition = Class.create({

  initialize: function(left, operator, right) {
    this.left = left;
    this.operator = operator;
    this.right = right;
    this.childRelation = null;
    this.childCondition = null;
    this.attachment = null;
  },

  evaluate: function(context) {
    context = context || new Liquid.Context();
    var result = this.interpretCondition(this.left, this.right, this.operator, context);
    switch(this.childRelation) {
      case 'or':
        return (result || this.childCondition.evaluate(context));
      case 'and':
        return (result && this.childCondition.evaluate(context));
      default:
        return result;
    }
  },

  or: function(condition) {
    this.childRelation = 'or';
    this.childCondition = condition;
  },

  and: function(condition) {
    this.childRelation = 'and';
    this.childCondition = condition;
  },

  attach: function(attachment) {
    this.attachment = attachment;
    return this.attachment;
  },

  isElse: false,

  interpretCondition: function(left, right, op, context) {
    if(!op)
      { return context.get(left); }

    left = context.get(left);
    right = context.get(right);
    op = Liquid.Condition.operators[op];
    if(!op)
      { throw ("Unknown operator "+ op); }

    var results = op(left, right);
    return results;
  },

  toString: function() {
    return "<Condition "+ this.left +" "+ this.operator +" "+ this.right +">";
  }

});

Liquid.Condition.operators = {
  '==': function(l,r) {  return (l == r); },
  '=':  function(l,r) { return (l == r); },
  '!=': function(l,r) { return (l != r); },
  '<>': function(l,r) { return (l != r); },
  '<':  function(l,r) { return (l < r); },
  '>':  function(l,r) { return (l > r); },
  '<=': function(l,r) { return (l <= r); },
  '>=': function(l,r) { return (l >= r); },

  'contains': function(l,r) { return $A(l).include(r); },
  'hasKey':   function(l,r) { return $H(l).keys().include(r); },
  'hasValue': function(l,r) { return $H(l).get(r); }
}

Liquid.ElseCondition = Class.create(Liquid.Condition, {

  isElse: true,

  evaluate: function(context) {
    return true;
  },

  toString: function() {
    return "<ElseCondition>";
  }

});
Liquid.Drop = Class.create({
  setContext: function(context) {
    this.context = context;
  },
  beforeMethod: function(method) {

  },
  invokeDrop: function(method) {
    var results = this.beforeMethod();
    if( !results && (method in this) )
      { results = this[method].apply(this); }
    return results;
  },
  hasKey: function(name) {
    return true;
  }
});
Liquid.Template.registerTag( 'assign', Class.create(Liquid.Tag, {

  tagSyntax: /((?:\(?[\w\-\.\[\]]\)?)+)\s*=\s*((?:"[^"]+"|'[^']+'|[^\s,|]+)+)/,

  initialize: function($super, tagName, markup, tokens) {
    var parts = markup.match(this.tagSyntax)
    if( parts ) {
      this.to   = parts[1];
      this.from = parts[2];
    } else {
      throw ("Syntax error in 'assign' - Valid syntax: assign [var] = [source]");
    }
    $super(tagName, markup, tokens)
  },
  render: function(context) {
    context.scopes.last().set( this.to.toString(), context.get(this.from));
    return '';
  }
}));

Liquid.Template.registerTag( 'cache', Class.create( Liquid.Block, {
  tagSyntax: /(\w+)/,

  initialize: function($super, tagName, markup, tokens) {
    var parts = markup.match(this.tagSyntax)
    if( parts ) {
      this.to = parts[1];
    } else {
      throw ("Syntax error in 'cache' - Valid syntax: cache [var]");
    }
    $super(tagName, markup, tokens);
  },
  render: function($super, context) {
    var output = $super(context);
    context.scopes.last()[this.to] = [output].flatten().join('');
    return '';
  }
}));


Liquid.Template.registerTag( 'capture', Class.create(Liquid.Block, {
  tagSyntax: /(\w+)/,

  initialize: function($super, tagName, markup, tokens) {
    var parts = markup.match(this.tagSyntax)
    if( parts ) {
      this.to = parts[1];
    } else {
      throw ("Syntax error in 'capture' - Valid syntax: capture [var]");
    }
    $super(tagName, markup, tokens);
  },
  render: function($super, context) {
    var output = $super(context);
    context.set( this.to, [output].flatten().join('') );
    return '';
  }
}));

Liquid.Template.registerTag( 'case', Class.create(Liquid.Block, {

  tagSyntax     : /("[^"]+"|'[^']+'|[^\s,|]+)/,
  tagWhenSyntax : /("[^"]+"|'[^']+'|[^\s,|]+)(?:(?:\s+or\s+|\s*\,\s*)("[^"]+"|'[^']+'|[^\s,|]+.*))?/,

  initialize: function($super, tagName, markup, tokens) {
    this.blocks = [];
    this.nodelist = [];

    var parts = markup.match(this.tagSyntax)
    if( parts ) {
      this.left = parts[1];
    } else {
      throw ("Syntax error in 'case' - Valid syntax: case [condition]");
    }

    $super(tagName, markup, tokens);
  },
  unknownTag: function($super, tag, markup, tokens) {
    switch(tag) {
      case 'when':
        this.recordWhenCondition(markup);
        break;
      case 'else':
        this.recordElseCondition(markup);
        break;
      default:
        $super(tag, markup, tokens);
    }

  },
  render: function(context) {
    var self = this,
        output = $A([]),
        execElseBlock = true;

    context.stack(function(){
      for (var i=0; i < self.blocks.length; i++) {
        var block = self.blocks[i];
        if( block.isElse  ) {
          if(execElseBlock == true){ output = $A([output, self.renderAll(block.attachment, context)]).flatten(); }
          return output;
        } else if( block.evaluate(context) ) {
          execElseBlock = false;
          output = $A([output, self.renderAll(block.attachment, context)]).flatten();
        }
      };
    });

    return output;
  },
  recordWhenCondition: function(markup) {
    while(markup) {
      var parts = markup.match(this.tagWhenSyntax);
      if(!parts) {
        throw ("Syntax error in tag 'case' - Valid when condition: {% when [condition] [or condition2...] %} ");
      }

      markup = parts[2];

      var block = new Liquid.Condition(this.left, '==', parts[1]);
      this.blocks.push( block );
      this.nodelist = block.attach([]);
    }
  },
  recordElseCondition: function(markup) {
    if( (markup || '').strip() != '') {
      throw ("Syntax error in tag 'case' - Valid else condition: {% else %} (no parameters) ")
    }
    var block = new Liquid.ElseCondition();
    this.blocks.push(block);
    this.nodelist = block.attach([]);
  }
}));

Liquid.Template.registerTag( 'comment', Class.create(Liquid.Block, {
  render: function(context) {
    return '';
  }
}));

Liquid.Template.registerTag( 'cycle', Class.create(Liquid.Tag, {

  tagSimpleSyntax: /"[^"]+"|'[^']+'|[^\s,|]+/,
  tagNamedSyntax:  /("[^"]+"|'[^']+'|[^\s,|]+)\s*\:\s*(.*)/,

  initialize: function($super, tag, markup, tokens) {
    var matches, variables;
    matches = markup.match(this.tagNamedSyntax);
    if(matches) {
      this.variables = this.variablesFromString(matches[2]);
      this.name = matches[1];
    } else {
      matches = markup.match(this.tagSimpleSyntax);
      if(matches) {
        this.variables = this.variablesFromString(markup);
        this.name = "'"+ this.variables.toString() +"'";
      } else {
        throw ("Syntax error in 'cycle' - Valid syntax: cycle [name :] var [, var2, var3 ...]");
      }
    }
    $super(tag, markup, tokens);
  },

  render: function(context) {
    var self   = this,
        key    = context.get(self.name),
        output = '';

    if(!context.registers['cycle']) {
      context.registers['cycle'] = $H({});
    }

    if(!context.registers['cycle'][key]) {
      context.registers['cycle'][key] = 0;
    }

    context.stack(function(){
      var iter    = context.registers['cycle'][key],
          results = context.get( self.variables[iter] );
      iter += 1;
      if(iter == self.variables.length){ iter = 0; }
      context.registers['cycle'][key] = iter;
      output = results;
    });

    return output;
  },

  variablesFromString: function(markup) {
    return markup.split(',').map(function(varname){
      var match = varname.match(/\s*("[^"]+"|'[^']+'|[^\s,|]+)\s*/);
      return (match[1]) ? match[1] : null
    });
  }
}));

Liquid.Template.registerTag( 'for', Class.create( Liquid.Block, {
  tagSyntax: /(\w+)\s+in\s+((?:\(?[\w\-\.\[\]]\)?)+)/,

  initialize: function($super, tag, markup, tokens) {
    var matches = markup.match(this.tagSyntax);
    if(matches) {
      this.variableName = matches[1];
      this.collectionName = matches[2];
      this.name = this.variableName +"-"+ this.collectionName;
      this.attributes = $H({});
      var attrmarkup = markup.replace(this.tagSyntax, '');
      var attMatchs = markup.match(/(\w*?)\s*\:\s*("[^"]+"|'[^']+'|[^\s,|]+)/g);
      if(attMatchs) {
        attMatchs.each(function(pair){
          pair = pair.split(":");
          this.attributes.set( pair[0].strip(), pair[1].strip());
        }, this);
      }
    } else {
      throw ("Syntax error in 'for loop' - Valid syntax: for [item] in [collection]");
    }
    $super(tag, markup, tokens);
  },

  render: function(context) {
    var self       = this,
        output     = [],
        collection = $A(context.get(this.collectionName) || []),
        range      = [0, collection.length];

    if(!context.registers['for']){ context.registers['for'] = $H({}); }

    if(this.attributes['limit'] || this.attributes['offset']) {
      var offset   = 0,
          limit    = 0,
          rangeEnd = 0,
          segement = null;

      if(this.attributes['offset'] == 'continue')
        { offset = context.registers['for'][this.name]; }
      else
        { offset = context.get( this.attributes['offset'] ) || 0; }

      limit = context.get( this.attributes['limit'] );

      rangeEnd = (limit) ? offset + limit + 1 : collection.length;
      range = [ offset, rangeEnd - 1 ];

      context.registers['for'][this.name] = rangeEnd;
    }

    segment = collection.slice(range[0], range[1]);
    if(!segment || segment.length == 0){ return ''; }

    context.stack(function(){
      var length = segment.length;

      segment.each(function(item, index){
        context.set( self.variableName, item );
        context.set( 'forloop', {
          name:   self.name,
          length: length,
          index:  (index + 1),
          index0: index,
          rindex: (length - index),
          rindex0:(length - index - 1),
          first:  (index == 0),
          last:   (index == (length - 1))
        });
        output.push( (self.renderAll(self.nodelist, context) || []).join('') );
      });
    });

    return [output].flatten().join('');
  }
}));

Liquid.Template.registerTag( 'if', Class.create(Liquid.Block, {

  tagSyntax: /("[^"]+"|'[^']+'|[^\s,|]+)\s*([=!<>a-z_]+)?\s*("[^"]+"|'[^']+'|[^\s,|]+)?/,

  initialize: function($super, tag, markup, tokens) {
    this.nodelist = [];
    this.blocks = [];
    this.pushBlock('if', markup);
    $super(tag, markup, tokens);
  },

  unknownTag: function($super, tag, markup, tokens) {
    if( $A(['elsif', 'else']).include(tag) ) {
      this.pushBlock(tag, markup);
    } else {
      $super(tag, markup, tokens);
    }
  },

  render: function(context) {
    var self = this,
        output = '';
    context.stack(function(){
      for (var i=0; i < self.blocks.length; i++) {
        var block = self.blocks[i];
        if( block.evaluate(context) ) {
          output = self.renderAll(block.attachment, context);
          return;
        }
      };
    })
    return [output].flatten().join('');
  },

  pushBlock: function(tag, markup) {
    var block;
    if(tag == 'else') {
      block = new Liquid.ElseCondition();
    } else {
      var expressions = markup.split(/\b(and|or)\b/).reverse(),
          expMatches  = expressions.shift().match( this.tagSyntax );

      if(!expMatches){ throw ("Syntax Error in tag '"+ tag +"' - Valid syntax: "+ tag +" [expression]"); }

      var condition = new Liquid.Condition(expMatches[1], expMatches[2], expMatches[3]);

      while(expressions.length > 0) {
        var operator = expressions.shift(),
            expMatches  = expressions.shift().match( this.tagSyntax );
        if(!expMatches){ throw ("Syntax Error in tag '"+ tag +"' - Valid syntax: "+ tag +" [expression]"); }

        var newCondition = new Liquid.Condition(expMatches[1], expMatches[2], expMatches[3]);
        newCondition[operator](condition);
        condition = newCondition;
      }

      block = condition;
    }
    block.attach($A([]));
    this.blocks.push(block);
    this.nodelist = block.attachment;
  }
}));

Liquid.Template.registerTag( 'ifchanged', Class.create( Liquid.Block, {

  render: function(context) {
    var self = this,
        output = '';
    context.stack(function(){
      var results = self.renderAll(self.nodelist, context).join('');
      if(results != context.registers['ifchanged']) {
        output = results;
        context.registers['ifchanged'] = output;
      }
    });
    return output;
  }
}));

Liquid.Template.registerTag( 'include', Class.create( Liquid.Tag, {

  tagSyntax: /((?:"[^"]+"|'[^']+'|[^\s,|]+)+)(\s+(?:with|for)\s+((?:"[^"]+"|'[^']+'|[^\s,|]+)+))?/,

  initialize: function($super, tag, markup, tokens) {
    var matches = (markup || '').match(this.tagSyntax);
    if(matches) {
      this.templateName = matches[1];
      this.templateNameVar = this.templateName.substring(1, this.templateName.length - 1);
      this.variableName = matches[3];
      this.attributes = $H({});

      var attMatchs = markup.match(/(\w*?)\s*\:\s*("[^"]+"|'[^']+'|[^\s,|]+)/g);
      if(attMatchs) {
        attMatchs.each(function(pair){
          pair = pair.split(":");
          this.attributes.set( pair[0].strip(), pair[1].strip() );
        }, this);
      }
    } else {
      throw ("Error in tag 'include' - Valid syntax: include '[template]' (with|for) [object|collection]");
    }
    $super(tag, markup, tokens);
  },

  render: function(context) {
    var self     = this,
        source   = Liquid.readTemplateFile( context.get(this.templateName) ),
        partial  = Liquid.parse(source),
        variable = context.get((this.variableName || this.templateNameVar)),
        output   = '';
    context.stack(function(){
      self.attributes.each(function(pair){
        context.set(pair.key, context.get(pair.value));
      })

      if(variable instanceof Array) {
        output = variable.map(function(variable){
          context.set( self.templateNameVar, variable );
          return partial.render(context);
        });
      } else {
        context.set(self.templateNameVar, variable);
        output = partial.render(context);
      }
    });
    output = [output].flatten().join('');
    return output
  }
}));

Liquid.Template.registerTag( 'unless', Class.create(Liquid.Template.tags['if'], {

  render: function(context) {
    var self = this,
        output = '';
    context.stack(function(){
      var block = self.blocks[0];
      if( !block.evaluate(context) ) {
        output = self.renderAll(block.attachment, context);
        return;
      }
      for (var i=1; i < self.blocks.length; i++) {
        var block = self.blocks[i];
        if( block.evaluate(context) ) {
          output = self.renderAll(block.attachment, context);
          return;
        }
      };
    })
    return output;
  }
}));
Liquid.Template.registerFilter({

  size: function(iterable) {
    return (iterable['length']) ? iterable.length : 0;
  },

  downcase: function(input) {
    return input.toString().toLowerCase();
  },

  upcase: function(input) {
    return input.toString().toUpperCase();
  },

  capitalize: function(input) {
    return input.toString().capitalize();
  },

  escape: function(input) {
    input = input.toString();
    input = input.replace(/&/g, '&amp;');
    input = input.replace(/</g, '&lt;');
    input = input.replace(/>/g, '&gt;');
    input = input.replace(/"/g, '&quot;');
    return input;
  },

  h: function(input) {
    input = input.toString();
    input = input.replace(/&/g, '&amp;');
    input = input.replace(/</g, '&lt;');
    input = input.replace(/>/g, '&gt;');
    input = input.replace(/"/g, '&quot;');
    return input;
  },

  truncate: function(input, length, string) {
    if(!input || input == ''){ return ''; }
    length = length || 50;
    string = string || "...";

    var seg = input.slice(0, length);
    return seg + string;
  },

  truncatewords: function(input, words, string) {
    if(!input || input == ''){ return ''; }
    words = parseInt(words || 15);
    string = string || '...';
    var wordlist = input.toString().split(" "),
        l = Math.max((words), 0);
    return (wordlist.length > l) ? wordlist.slice(0,l).join(' ') + string : input;
  },

  truncate_words: function(input, words, string) {
    if(!input || input == ''){ return ''; }
    words = parseInt(words || 15);
    string = string || '...';
    var wordlist = input.toString().split(" "),
        l = Math.max((words), 0);
    return (wordlist.length > l) ? wordlist.slice(0,l).join(' ') + string : input;
  },

  strip_html: function(input) {
    return input.toString().replace(/<.*?>/g, '');
  },

  strip_newlines: function(input) {
    return input.toString().replace(/\n/g, '')
  },

  join: function(input, separator) {
    separator = separator ||  ' ';
    return input.join(separator);
  },

  sort: function(input) {
    return input.sort();
  },

  reverse: function(input) {
    return input.reverse();
  },

  replace: function(input, string, replacement) {
    replacement = replacement || '';
    return input.toString().replace(new RegExp(string, 'g'), replacement);
  },

  replace_first: function(input, string, replacement) {
    replacement = replacement || '';
    return input.toString().replace(new RegExp(string, ""), replacement);
  },

  newline_to_br: function(input) {
    return input.toString().replace(/\n/g, "<br/>\n");
  },

  date: function(input, format) {
    var date;
    if( input instanceof Date ){ date = input; }
    if(!(date instanceof Date) && input == 'now'){ date = new Date(); }
    if(!(date instanceof Date)){ date = new Date(input); }
    if(!(date instanceof Date)){ date = new Date(Date.parse(input));}
    if(!(date instanceof Date)){ return input; } // Punt
    return date.strftime(format);
  },

  first: function(input) {
    return input[0];
  },

  last: function(input) {
    input = input;
    return input[input.length -1];
  }
});


if(!(new Date()).strftime) {(function(){
Date.ext={};Date.ext.util={};Date.ext.util.xPad=function(x,pad,r){if(typeof (r)=="undefined"){r=10}for(;parseInt(x,10)<r&&r>1;r/=10){x=pad.toString()+x}return x.toString()};Date.prototype.locale="en-GB";if(document.getElementsByTagName("html")&&document.getElementsByTagName("html")[0].lang){Date.prototype.locale=document.getElementsByTagName("html")[0].lang}Date.ext.locales={};Date.ext.locales.en={a:["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],A:["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],b:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],B:["January","February","March","April","May","June","July","August","September","October","November","December"],c:"%a %d %b %Y %T %Z",p:["AM","PM"],P:["am","pm"],x:"%d/%m/%y",X:"%T"};Date.ext.locales["en-US"]=Date.ext.locales.en;Date.ext.locales["en-US"].c="%a %d %b %Y %r %Z";Date.ext.locales["en-US"].x="%D";Date.ext.locales["en-US"].X="%r";Date.ext.locales["en-GB"]=Date.ext.locales.en;Date.ext.locales["en-AU"]=Date.ext.locales["en-GB"];Date.ext.formats={a:function(d){return Date.ext.locales[d.locale].a[d.getDay()]},A:function(d){return Date.ext.locales[d.locale].A[d.getDay()]},b:function(d){return Date.ext.locales[d.locale].b[d.getMonth()]},B:function(d){return Date.ext.locales[d.locale].B[d.getMonth()]},c:"toLocaleString",C:function(d){return Date.ext.util.xPad(parseInt(d.getFullYear()/100,10),0)},d:["getDate","0"],e:["getDate"," "],g:function(d){return Date.ext.util.xPad(parseInt(Date.ext.util.G(d)/100,10),0)},G:function(d){var y=d.getFullYear();var V=parseInt(Date.ext.formats.V(d),10);var W=parseInt(Date.ext.formats.W(d),10);if(W>V){y++}else{if(W===0&&V>=52){y--}}return y},H:["getHours","0"],I:function(d){var I=d.getHours()%12;return Date.ext.util.xPad(I===0?12:I,0)},j:function(d){var ms=d-new Date(""+d.getFullYear()+"/1/1 GMT");ms+=d.getTimezoneOffset()*60000;var doy=parseInt(ms/60000/60/24,10)+1;return Date.ext.util.xPad(doy,0,100)},m:function(d){return Date.ext.util.xPad(d.getMonth()+1,0)},M:["getMinutes","0"],p:function(d){return Date.ext.locales[d.locale].p[d.getHours()>=12?1:0]},P:function(d){return Date.ext.locales[d.locale].P[d.getHours()>=12?1:0]},S:["getSeconds","0"],u:function(d){var dow=d.getDay();return dow===0?7:dow},U:function(d){var doy=parseInt(Date.ext.formats.j(d),10);var rdow=6-d.getDay();var woy=parseInt((doy+rdow)/7,10);return Date.ext.util.xPad(woy,0)},V:function(d){var woy=parseInt(Date.ext.formats.W(d),10);var dow1_1=(new Date(""+d.getFullYear()+"/1/1")).getDay();var idow=woy+(dow1_1>4||dow1_1<=1?0:1);if(idow==53&&(new Date(""+d.getFullYear()+"/12/31")).getDay()<4){idow=1}else{if(idow===0){idow=Date.ext.formats.V(new Date(""+(d.getFullYear()-1)+"/12/31"))}}return Date.ext.util.xPad(idow,0)},w:"getDay",W:function(d){var doy=parseInt(Date.ext.formats.j(d),10);var rdow=7-Date.ext.formats.u(d);var woy=parseInt((doy+rdow)/7,10);return Date.ext.util.xPad(woy,0,10)},y:function(d){return Date.ext.util.xPad(d.getFullYear()%100,0)},Y:"getFullYear",z:function(d){var o=d.getTimezoneOffset();var H=Date.ext.util.xPad(parseInt(Math.abs(o/60),10),0);var M=Date.ext.util.xPad(o%60,0);return(o>0?"-":"+")+H+M},Z:function(d){return d.toString().replace(/^.*\(([^)]+)\)$/,"$1")},"%":function(d){return"%"}};Date.ext.aggregates={c:"locale",D:"%m/%d/%y",h:"%b",n:"\n",r:"%I:%M:%S %p",R:"%H:%M",t:"\t",T:"%H:%M:%S",x:"locale",X:"locale"};Date.ext.aggregates.z=Date.ext.formats.z(new Date());Date.ext.aggregates.Z=Date.ext.formats.Z(new Date());Date.ext.unsupported={};Date.prototype.strftime=function(fmt){if(!(this.locale in Date.ext.locales)){if(this.locale.replace(/-[a-zA-Z]+$/,"") in Date.ext.locales){this.locale=this.locale.replace(/-[a-zA-Z]+$/,"")}else{this.locale="en-GB"}}var d=this;while(fmt.match(/%[cDhnrRtTxXzZ]/)){fmt=fmt.replace(/%([cDhnrRtTxXzZ])/g,function(m0,m1){var f=Date.ext.aggregates[m1];return(f=="locale"?Date.ext.locales[d.locale][m1]:f)})}var str=fmt.replace(/%([aAbBCdegGHIjmMpPSuUVwWyY%])/g,function(m0,m1){var f=Date.ext.formats[m1];if(typeof (f)=="string"){return d[f]()}else{if(typeof (f)=="function"){return f.call(d,d)}else{if(typeof (f)=="object"&&typeof (f[0])=="string"){return Date.ext.util.xPad(d[f[0]](),f[1])}else{return m1}}}});d=null;return str};
})();}
