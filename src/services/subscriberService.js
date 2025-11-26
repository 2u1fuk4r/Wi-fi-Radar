const { 
  SubscribeCommand, 
  UnsubscribeCommand,
  PublishCommand,
  ListSubscriptionsByTopicCommand 
} = require("@aws-sdk/client-sns");
const { SendEmailCommand } = require("@aws-sdk/client-ses");
const { snsClient, sesClient } = require("../config/aws");

class SubscriberService {
  async subscribe(contact, type) {
    try {
      if (type === 'sms') {
        const params = {
          Protocol: 'SMS',
          TopicArn: process.env.SNS_TOPIC_ARN,
          Endpoint: contact
        };
        const command = new SubscribeCommand(params);
        return await snsClient.send(command);
      } else if (type === 'email') {
        const params = {
          Protocol: 'email',
          TopicArn: process.env.SNS_TOPIC_ARN,
          Endpoint: contact
        };
        const command = new SubscribeCommand(params);
        return await snsClient.send(command);
      }
    } catch (error) {
      console.error('Error subscribing:', error);
      throw error;
    }
  }

  async unsubscribe(subscriptionArn) {
    try {
      const params = {
        SubscriptionArn: subscriptionArn
      };
      const command = new UnsubscribeCommand(params);
      return await snsClient.send(command);
    } catch (error) {
      console.error('Error unsubscribing:', error);
      throw error;
    }
  }

  async sendMessage(message, type, recipients = []) {
    try {
      if (type === 'sms') {
        const params = {
          Message: message,
          TopicArn: process.env.SNS_TOPIC_ARN
        };
        const command = new PublishCommand(params);
        return await snsClient.send(command);
      } else if (type === 'email') {
        const params = {
          Source: process.env.SES_FROM_EMAIL,
          Destination: {
            ToAddresses: recipients,
          },
          Message: {
            Subject: {
              Data: 'New Message from Mass Messaging System',
            },
            Body: {
              Text: {
                Data: message,
              },
            },
          },
        };
        const command = new SendEmailCommand(params);
        return await sesClient.send(command);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async listSubscribers() {
    try {
      const params = {
        TopicArn: process.env.SNS_TOPIC_ARN
      };
      const command = new ListSubscriptionsByTopicCommand(params);
      const result = await snsClient.send(command);
      return result.Subscriptions;
    } catch (error) {
      console.error('Error listing subscribers:', error);
      throw error;
    }
  }
}

module.exports = new SubscriberService();