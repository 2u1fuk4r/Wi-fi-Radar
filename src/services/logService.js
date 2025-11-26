const { PutCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../config/aws");

class LogService {
  constructor() {
    this.tableName = process.env.DYNAMODB_LOGS_TABLE || 'message_logs';
  }

  async logMessage(type, message, recipients, status) {
    const params = {
      TableName: this.tableName,
      Item: {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        type,
        message,
        recipients: Array.isArray(recipients) ? recipients : [recipients],
        status
      }
    };

    await docClient.send(new PutCommand(params));
  }

  async getLogs() {
    const params = {
      TableName: this.tableName,
      ScanIndexForward: false, // Get most recent first
      Limit: 100
    };

    const result = await docClient.send(new QueryCommand(params));
    return result.Items;
  }
}

module.exports = new LogService();