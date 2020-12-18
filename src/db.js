/**
 * this module only provides the API for what should become the real DB module
 */

const CONNECTION = Symbol('connection');

class DBConnection{
    static counter = 0;
    constructor(){
        DBConnection.counter++;
        this.id = DBConnection.counter;
    }

    release(){
        // does absoloutly nothing
    }
}

module.exports.getConnection = function () {
    return new DBConnection();
}

module.exports.executeQuery = async function (query) {
    let connection;

    if(this[CONNECTION] !== null){
        connection = this[CONNECTION];
        return new Promise((resolve,_)=>{
            resolve(`
                queryExecuted: ${query}
                connection: ${connection.id}
            `);
        });
    }else{
        connection = new DBConnection();
        return new Promise((resolve,_)=>{
            resolve(`
                queryExecuted: ${query}
                connection: ${connection.id}
            `);
            connection.release();
        });
    }
}

module.exports.beginTransaction = async function (connection) {
    // nothing for now
}

module.exports.commitTransaction = async function (connection) {
    // nothing for now
}

module.exports.rollbackTransaction = async function (connection) {
    // nothing for now
}

module.exports.CONNECTION = CONNECTION;