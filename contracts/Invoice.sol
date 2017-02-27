import "AuthStoppable.sol";
import "BSTokenFrontend.sol";
import "TokenRecipient.sol";

pragma solidity ^0.4.2;

contract Invoice is AuthStoppable, TokenRecipient {
    BSTokenFrontend token;
    address bsTokenFrontendAddress;

    function Invoice(address theBSTokenFrontendAddress, address collector, address permissionManagerAddress){
        bsTokenFrontendAddress = theBSTokenFrontendAddress;
        token = BSTokenFrontend(bsTokenFrontendAddress);
        super.init(collector, permissionManagerAddress);
    }

    //Merchant should be rewrite in order to express the collector identity
    function create(string idInvoice, address debtor, address beneficiary, uint256 amount, uint256 collectorFee,
        uint256 paymentDueDate) onlyAdminOrMerchant
    {
        invoices[idInvoice] = InvoiceData(debtor, beneficiary, msg.sender, amount, collectorFee, paymentDueDate, false);
    }

    struct InvoiceData {
        address debtor;
        address beneficiary;
        address collector;
        uint256 amount;
        uint256 collectorFee;
        uint256 paymentDueDate;
        bool isPaid;
    }

   event Paid(address indexed debtor, address indexed beneficiary, uint256 amount);

   mapping (string => InvoiceData) invoices;

    //CashIn
    function receiveApproval(address debtor, address beneficiary, string idInvoice, uint256 amount)
        stopInEmergency onlyBSToken amountMatches(idInvoice, amount) justInTime(idInvoice) {
        token.transferFrom(debtor, this, amount);

        InvoiceData invoiceData = invoices[idInvoice];
        token.transfer(invoiceData.beneficiary, (amount * (100 - invoiceData.collectorFee)) / 100);
        token.transfer(invoiceData.collector, (amount * invoiceData.collectorFee) / 100);
        invoiceData.isPaid = true;

        Paid(debtor, beneficiary, amount);
    }

    function get(string idInvoice) public constant
        returns(address debtor, address beneficiary, address collector,
        uint256 amount, uint256 collectorFee, uint256 paymentDueDat, bool isPaid)
    {
        InvoiceData invoice = invoices[idInvoice];
        debtor = invoice.debtor;
        beneficiary = invoice.beneficiary;
        collector = invoice.collector;
        amount = invoice.amount;
        collectorFee = invoice.collectorFee;
        paymentDueDat = invoice.paymentDueDate;
        isPaid = invoice.isPaid;
    }

    modifier invoiceDoesNotExist(string assetId) {
        if (invoices[assetId].collector != address(0x0))
            throw;
        _;
    }

    modifier onlyCollector() {
        if (msg.sender != bsTokenFrontendAddress)
            throw;
        _;
    }

    modifier onlyBSToken() {
        if (msg.sender != bsTokenFrontendAddress)
            throw;
        _;
    }

    modifier amountMatches(string idInvoice, uint256 amount) {
        if (invoices[idInvoice].amount != amount)
            throw;
        _;
    }

    modifier justInTime(string idInvoice) {
        if (now > invoices[idInvoice].paymentDueDate)
            throw;
        _;
    }
}