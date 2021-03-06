'use strict';
module.exports = function(server, databaseObj, helper, packageObj) {

    var adminUserModel = packageObj.adminUser,
        User = databaseObj.User,
        Role = server.models.Role,
        RoleMapping = server.models.RoleMapping,
        loopback = helper.getLoopbackObj(),

        //Create an init method to be executed when the plugin get run for the first time..in memory..
        init = function() {

            /**
             * Permission levels
             * ADMIN -> STATIC ROLE DECLARATION.
             * STAFF -> DYNAMIC ROLE DECLARATION.
             */
            //Now adding user to the method..
            User.create(adminUserModel)
                .then(function(err, users) {
                    if (err) throw err;
                    var i;
                    console.log('\n\nCreated users:', users);

                    //create the admin role
                    Role.create({
                        name: 'admin'
                    }, function(err, role) {
                        if (err) throw err;
                        for (i = 0; i < users.length; i++) {
                            //Making this user an admin.
                            addUserAdmin(role, users[i].id);
                        } //for loop..
                    });
                })
                .catch(function(err) {


                    var where = {};
                    where.or = [];
                    for (var i = 0; i < adminUserModel.length; i++) {
                        var model = adminUserModel[i];
                        where.or.push({
                            email: model.email
                        });
                    }
                    User.find({
                        where: where
                    }, function(err, users) {
                        if(!err){
                            if (users.length) {
                                //create the admin role
                                Role.create({
                                    name: 'admin'
                                }, function(err, role) {
                                    if (err) {
                                        throw err;
                                    }
                                    for (i = 0; i < users.length; i++) {
                                        //Making this user an admin..
                                        console.log(users[0]);
                                        addUserAdmin(role, users[0].id);
                                    } //for loop..
                                });
                            }
                        }

                    });

                    console.error("Got error");
                    console.log(err);

                });

            //TODO MODIFY THIS METHOD TO PROVIDE RUNTIME ACCESS AND MODIFICATION TO USER.
            addStaffResolver();
            hideRestMethods();

            User.isAdmin = function(cb) {
                var currentContext = loopback.getCurrentContext();
                var app = this.app;
                isAdmin(app, currentContext, cb);
            };



            //Now defigning a method for checking if the user exist in the role.
            User.remoteMethod(
                'isAdmin', {
                    returns: {
                        arg: 'isAdmin',
                        type: 'boolean'
                    }
                }
            );

        }, //Init..


        isAdmin = function(app, currentContext, cb) {
            Role = app.models.Role;
            RoleMapping = app.models.RoleMapping;
            //bad documentation loopback..
            //http://stackoverflow.com/questions/28194961/is-it-possible-to-get-the-current-user-s-roles-accessible-in-a-remote-method-in
            //https://github.com/strongloop/loopback/issues/332
            var context;

            try {
                context = {
                    principalType: RoleMapping.USER,
                    principalId: currentContext.active.accessToken.userId
                };
            } catch (err) {
                console.error("Error >> User not logged in. ");
                context = {
                    principalType: RoleMapping.USER,
                    principalId: null
                };
            }

            //console.log(context);

            //Now check the role if the context is admin.
            Role.isInRole('admin', context, function(err, InRole) {
                if (err) {
                    return cb(err);
                }
                var result = InRole;
                //console.log(result);
                //Now return the boolean value..
                cb(null, result);
            });
        },


        //Internal method for checking if current user in a role with the given loopback..
        //Method to be useful fot plugins..
        verifyRole = function(role, callback) {
            Role = server.models.Role;
            RoleMapping = server.models.RoleMapping;
            var currentContext = loopback.getCurrentContext();
            var app = server;
            isInRole(app, role, currentContext, callback);
        },


        //Check if a particular user is in role..
        isInRole = function(app, role, currentContext, cb) {
            Role = app.models.Role;
            RoleMapping = app.models.RoleMapping;
            //bad documentation loopback..
            //http://stackoverflow.com/questions/28194961/is-it-possible-to-get-the-current-user-s-roles-accessible-in-a-remote-method-in
            //https://github.com/strongloop/loopback/issues/332
            var context;

            try {
                context = {
                    principalType: RoleMapping.USER,
                    principalId: currentContext.active.accessToken.userId
                };
            } catch (err) {
                console.error("Error >> User not logged in. ");
                context = {
                    principalType: RoleMapping.USER,
                    principalId: null
                };
            }

            //console.log(context);

            //Now check the role if the context is admin.
            Role.isInRole(role, context, function(err, InRole) {
                if (err) {
                    return cb(err);
                }
                var result = InRole;
                //console.log(result);
                //Now return the boolean value..
                cb(null, result);
            });
        },




        //TODO ADD GUEST AND CUSTOMER ROLE RESOLVER AND PROVIDE IT FOR CUSTOMER.
        //Method for resolving staff role by user..
        addStaffResolver = function() {
            //Now registering an dynamic role for the user..
            //All user of the employee model  belong to the staff role.
            /**
             * Default User  ACLs.
             DENY EVERYONE *
             ALLOW admin create
             ALLOW OWNER deleteById
             ALLOW EVERYONE login
             ALLOW EVERYONE logout
             ALLOW staff findById
             ALLOW OWNER updateAttributes

             */
            //If a users is logged by Employee account the he is a staff.
            Role.registerResolver('staff', function(role, context, cb) {
                
                function reject(err) {
                    if (err) {
                        return cb(err);
                    }
                    cb(null, false);
                }

                function accept() {
                    cb(null, true);
                }

                var userId = context.accessToken.userId;
                if (!userId) {
                    return reject(); // do not allow anonymous users
                }


                //Now check if the logged in user is an Employee
                User.exists(userId, function(err, exists){
                    if(err){
                        console.log('Error occured in finding user for role of Staff.');
                        console.log(err);
                        return reject();
                    }else{
                        if(exists){
                            //Accept the staff role..
                            return accept();
                        }else{
                            return reject();
                        }
                    }
                });
            });//register resolver..

        },




        /**
         * Method for adding static admin role to an user
         * @param adminRoleInstance
         * @param userInstanceId
         */
        addUserAdmin = function(adminRoleInstance, userInstanceId) {
            //make users an admin
            adminRoleInstance.principals.create({
                principalType: RoleMapping.USER,
                principalId: userInstanceId
            }, function(err, principal) {
                if (err) {
                    throw err;
                }
                console.log('Created principal:', principal);
            });
        },





        //TODO MODIFY THIS METHOD TO CHANGE IT FROM THIS FUNCTION DYNAMICALLY
        hideRestMethods = function() {
            //Hiding all the rest endpoints except login/logout/create

            //User.disableRemoteMethod("create", true);
            //User.disableRemoteMethod("upsert", true);
            //User.disableRemoteMethod("updateAll", true);
            //User.disableRemoteMethod("updateAttributes", false);

            //User.disableRemoteMethod("find", true);
            //User.disableRemoteMethod("findById", true);
            //User.disableRemoteMethod("findOne", true);

            //User.disableRemoteMethod("deleteById", true);

            //User.disableRemoteMethod("confirm", true);
            //User.disableRemoteMethod("count", true);
            //User.disableRemoteMethod("exists", true);
            //User.disableRemoteMethod("resetPassword", true);

            //User.disableRemoteMethod('__count__accessTokens', false);
            //User.disableRemoteMethod('__create__accessTokens', false);
            //User.disableRemoteMethod('__delete__accessTokens', false);
            //User.disableRemoteMethod('__destroyById__accessTokens', false);
            //User.disableRemoteMethod('__findById__accessTokens', false);
            //User.disableRemoteMethod('__get__accessTokens', false);
            //User.disableRemoteMethod('__updateById__accessTokens', false);
        };


    //Now return the methods that you want other plugins to use
    return {
        init: init,
        hideRestMethods: hideRestMethods,
        addUserAdmin: addUserAdmin,
        isAdmin: isAdmin,
        verifyRole: verifyRole
    };



};
