const {
    CONNECTION, // symbol
    executeQuery, 
    getConnection, 
    beginTransaction, 
    commitTransaction, 
    rollbackTransaction
} = require('./db.js');

module.exports.Model = function (constructor) {
    const className = constructor.name;

    forEveryMethod(constructor,(methodName,methodValue)=>{
        constructor[methodName] = changeLexicalScope(className,"this",methodValue);
    });

    forEveryMethod(constructor.prototype,(methodName,methodValue)=>{
        if(methodName === 'constructor') return;

        constructor.prototype[methodName] = changeLexicalScope(className,"this.constructor",methodValue);
    });

    constructor.executeQuery = executeQuery;
    constructor.prototype.executeQuery = executeQuery;

    constructor[CONNECTION] = null;
    constructor.prototype[CONNECTION] = null;
}

module.exports.Transaction = function (target,key) {
    const method = target[key];

    function wrapper(...args) {
        const context = this;

        let connection = getConnection();

        const constructorHandler = {
            get: function (target,prop,reciever) {
                if(prop === CONNECTION){
                    return connection;
                }else{
                    return Reflect.get(target,prop,reciever);
                }
            },

            construct: function (target,args) {
                const instance = Reflect.construct(target,args);
                Object.defineProperty(instance,CONNECTION,{
                    get: function () {
                        return connection;
                    }
                });
                return instance;
            }
        }

        let handler = {}

        if(target.hasOwnProperty('constructor')){// operating on an instance method
            const constructorProxy = new Proxy(target.constructor,constructorHandler);
            
            handler = {
                get: function (target,prop,reciever) {
                    if(prop === CONNECTION){
                        return connection;
                    }else if(prop === 'constructor'){
                        return constructorProxy;
                    }else{
                        Reflect.get(target,prop,reciever);
                    }
                }
            }

        }else{// operating on a static method
            handler = constructorHandler;
        }

        const prox = new Proxy(context,handler);

        let returnedValue;

        return beginTransaction(connection)
        .then(()=>{
            return method.call(prox,args);  
        })
        .then(_returnedValue=>{
            returnedValue = _returnedValue;
            return commitTransaction(connection);
        })
        .then(()=>{
            connection.release()
            connection = null;
            return returnedValue;
        })
        .catch(err=>{
            rollbackTransaction(connection);
            connection = null;
            return Promise.reject(err);
        });
    }

    return wrapper;
}

function forEveryMethod (obj, callback) {
    Object.getOwnPropertyNames(obj).forEach(propName=>{
        const propValue = obj[propName];
        if(typeof propValue === 'function') callback(propName,propValue);
    });
}

function changeLexicalScope(varName,varValue,func) {
    // TO-DO : notice that the variable names here inside this function 'could' coincide with the varName, so solve that.
    // TO-DO : try to extend this function to handle multible variables.
    let newFunc = new Function();
    const funcStr = sanitizeFunctionDefinition(func.toString());
    const code = `
    let ${varName} = ${varValue};
    const tempFunc = ${funcStr}
    newFunc = tempFunc;
    `
    eval(code);
    console.log('costly operation performed');
    return newFunc;
}

function sanitizeFunctionDefinition(funcStr) {
    const funcPattern = /^((async\s*?)|((async\s+?)?((function\s*?)|((function\s+?)?(.*?)))))(\(.*?\))\s*?(=>)?\s*?(\{.*\})$/s

    function parseAndReplace(wholeMatch,_,_2,_3,asyncAsPart,_4,_5,_6,functionAsPart,functionName,argsPart,arrow,functionBody) {
        let sanitizedOutput;
        if(arrow === undefined){
            const asyncPart = asyncAsPart || '';
            const functionPart = functionAsPart || 'function';
            const name = functionName || '';
            sanitizedOutput = `${asyncPart} ${functionPart} ${name}${argsPart}${functionBody}`;
        }else{
            sanitizedOutput = wholeMatch;
        }

        return sanitizedOutput;
    }

    return funcStr.replace(funcPattern,parseAndReplace);
}