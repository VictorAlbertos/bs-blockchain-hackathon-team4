'use strict';

const TestRPC = require('ethereumjs-testrpc');
const Web3 = require('web3');
const BSTokenData = require('bs-token-data');
const BSTokenBanking = require('bs-token-banking');
const BSToken = require('bs-token');
const Invoice = require('../src/index');
const GTPermissionManager = require('gt-permission-manager');
const Promise = require('bluebird');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

const assert = chai.assert;
chai.use(chaiAsPromised);
chai.should();

const provider = TestRPC.provider({
    accounts: [{
        index: 0,
        secretKey: '0x998c22e6ab1959d6ac7777f12d583cc27d6fb442c51770125ab9246cb549db80',
        balance: 200000000
    }, {
        index: 1,
        secretKey: '0x998c22e6ab1959d6ac7777f12d583cc27d6fb442c51770125ab9246cb549db81',
        balance: 200000000
    }, {
        index: 2,
        secretKey: '0x998c22e6ab1959d6ac7777f12d583cc27d6fb442c51770125ab9246cb549db82',
        balance: 200000000
    }, {
        index: 3,
        secretKey: '0x998c22e6ab1959d6ac7777f12d583cc27d6fb442c51770125ab9246cb549db83',
        balance: 200000000
    }]
});

const web3 = new Web3(provider);

Promise.promisifyAll(web3.eth);
Promise.promisifyAll(web3.personal);

describe('Invoice contract', function () {
    const gas = 3000000;
    const idInvoice = '1';
    const amount = 100;
    const admin = '0x5bd47e61fbbf9c8b70372b6f14b068fddbd834ac';
    const debtor = '0x25e940685e0999d4aa7bd629d739c6a04e625761';
    const beneficiary = '0x6128333118cef876bd620da1efa464437470298d';
    const collectorFee = 10;
    const paymentDueDate = 1234567891011121314;
    let permissionManager;
    let bsTokenFrontend;
    let bsTokenBanking;
    let bsTokenData;

    var invoice;

    before(function() {
        this.timeout(60000);
        return GTPermissionManager.deployContract(web3, admin, gas)
            .then((contract) => {
                permissionManager = contract;
                return BSTokenData.deployContract(web3, admin, permissionManager, gas);
            })
            .then(contract => {
                bsTokenData = contract;
                return BSTokenBanking.deployContract(web3, admin, bsTokenData, permissionManager, gas);
            })
            .then((contract) => {
                bsTokenBanking = contract;
                return BSToken.deployContract(web3, admin, admin, bsTokenData, permissionManager, gas);
            })
            .then((contract) => {
                bsTokenFrontend = contract;
                return Invoice.deployContract(web3, admin, bsTokenFrontend, admin, permissionManager, gas);
            })
            .then((contract) => invoice = contract);
    });

    describe('check invoice', () => {
        it('add cash to debtor', () => {
            return bsTokenBanking.cashInAsync(debtor, amount, { from: admin, gas: gas});
        });

        it('create', () => {
            return invoice.createAsync(idInvoice, debtor, beneficiary, amount, collectorFee, paymentDueDate,
                { from: admin, gas: gas});
        });

        it('check invoice', () => {
            return invoice.getAsync(idInvoice).then(invoice => {
                assert.equal(invoice[3].toNumber(), amount);
                assert.equal(invoice[6], false);
            });
        });

        it('pay invoice using aproveAndCall should fail', () => {
            return bsTokenFrontend.approveAndCallAsync(invoice.address, beneficiary, idInvoice, amount - 5, {
                from: debtor,
                gas: gas
            }).should.eventually.be.rejected;
        });

        it('pay invoice using aproveAndCall', () => {
            return bsTokenFrontend.approveAndCallAsync(invoice.address, beneficiary, idInvoice, amount, {
                from: debtor,
                gas: gas
            });
        });

        it('check invoice', () => {
            return invoice.getAsync(idInvoice).then(invoice => {
                assert.equal(invoice[6], true);
            });
        });

        it('check balance debtor', () => {
            return bsTokenFrontend.balanceOfAsync(debtor).then(expected => {
                assert.equal(expected.valueOf(), 0);
            });
        });

        it('check balance beneficiary', () => {
            return bsTokenFrontend.balanceOfAsync(beneficiary).then(expected => {
                assert.equal(expected.valueOf(), 90);
            });
        });

        it('check balance collector', () => {
            return bsTokenFrontend.balanceOfAsync(admin).then(expected => {
                assert.equal(expected.valueOf(), 10);
            });
        });
    });
});
