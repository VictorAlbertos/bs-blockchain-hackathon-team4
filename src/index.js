'use strict';

const fs = require('fs');
const Promise = require('bluebird');
const path = require('path');
const Deployer = require('contract-deployer');
const BSToken = require('bs-token');

exports.contracts = Object.freeze(Object.assign({}, BSToken.contracts, {
    'Invoice.sol': fs.readFileSync(path.join(__dirname, '../contracts/Invoice.sol'), 'utf8')
}));

exports.deployContract = function deployContract(web3, admin, bsToken, collector,
                                                            permissionManager, gas) {
    const deployer = new Deployer(web3, { sources: exports.contracts }, 0);
    return deployer
        .deploy('Invoice', [bsToken.address, collector, permissionManager.address], { from: admin, gas })
        .then((invoice) => {
            checkContract(invoice);
            return invoice;
        });
};

exports.deployedContract = function deployedContract(web3, abi, address) {
    const invoice = web3.eth.contract(abi).at(address);
    Promise.promisifyAll(invoice);
    checkContract(invoice);
    return Promise.resolve(invoice);
};

function checkContract(invoice) {
    if (!invoice.abi) {
        throw new Error('abi must not be null');
    }

    if (!invoice.address) {
        throw new Error('address must not be null');
    }

    if (typeof invoice.createAsync === 'undefined') {
        throw new Error('contract has not been properly deployed');
    }
}