const Client = require('../models').Client;
const UniqueCode = require('../models').UniqueCode;

const authTypesConfig = require('../config').authTypes;

exports.withAll = (req, res, next) => {
  Client
    .fetchAll()
    .then((clients) => {
       req.clientsCollection = clients;
       req.clients = clients.serialize();
       next();
    })
    .catch((err) => { next(err); });
}

exports.withOne = (req, res, next) => {
  let clientId = req.body && req.body.clientId ? req.body.clientId : req.query.clientId;

  if (!clientId) {
    clientId = req.query.client_id;
  }

  if (clientId) {
    new Client({ clientId: clientId })
    .fetch()
    .then((client) => {
      if (client) {
        req.clientModel = client;
        req.client = client.serialize();

        const clientConfig = JSON.parse(req.client.config);
        res.locals.clientProjectUrl = clientConfig.projectUrl;
        res.locals.clientEmail = clientConfig.contactEmail;
        res.locals.clientDisclaimerUrl = clientConfig.clientDisclaimerUrl;

        next();
      } else {
        throw new Error('No Client found for clientID');
      }
    })
    .catch((err) => { next(err); });
  } else {
    throw new Error('No Client ID is set for login');
  }
}


exports.withOneById = (req, res, next) => {
  const clientId = req.params.clientId;

  if (clientId) {
    new Client({ id: clientId })
    .fetch()
    .then((client) => {
      if (client) {
        req.clientModel = client;
        req.client = client.serialize();
        next();
      } else {
        throw new Error('No Client found for clientID');
      }
    })
    .catch((err) => { next(err); });
  } else {
    throw new Error('No Client ID is set for login');
/*
    next({
      name: 'ClientNotFoundError',
      status: 404,
      message:
    });
*/
  }
}

/**
 * Add the login option
 */
exports.setAuthType = (authType) => {
  return (req, res, next) => {
    req.authType = authType;
    next();
  }
}

exports.validate = (req, res, next) => {
  let authTypes = req.clientModel.getAuthTypes(req.clientModel);
  const allowedType = authTypes && authTypes.length > 0 ? authTypes.find(option => option.key === req.authType) : false;

  /**
   * Check if any login options are defined for the client, otherwise error!
   */
  if (!authTypes) {
    throw new Error('No auth types selected');
  }

  /**
   * Check if auth type is allowed for client
   */
  if (!allowedType) {
    throw new Error('Auth types not allowed');
  }

  next();
}

exports.checkUniqueCodeAuth = (errorCallback) => {
  //validate code auth type
  return (req, res, next) => {
      const authTypes = JSON.parse(req.client.authTypes);

      if (authTypes.indexOf('UniqueCode') !== -1) {
        new UniqueCode({ clientId: req.client.id, userId: req.user.id })
        .fetch()
        .then((codeResponse) => {
          if (!!codeResponse) {
            next();
          } else {
            throw new Error('Not validated with Unique Code');
          }
        })
        .catch((error) => {
          console.log('error checkRequiredUserFields');

          if (errorCallback) {
            try {
              errorCallback(req, res, next);
            } catch (err) {
              next(err)
            }
          } else {
            next(error);
          }
        });

      } else {
        next();
      }
    }
}

exports.checkRequiredUserFields = (req, res, next) => {
  const requiredFields = JSON.parse(req.client.requiredUserFields);
  const user = req.user;
  let error;

  if (requiredFields) {
    requiredFields.forEach((field) => {
      // if at least one required field is empty, set to error
      error = error || !req.user[field];
    });
  }

  // if error redirect to register
  if (error) {
    res.redirect('/auth/required-fields?clientId=' + req.client.clientId || '/account');
  } else {
    next();
  }
}
