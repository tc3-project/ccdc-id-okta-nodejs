// app.js
// Copyright © 2018-2022 Joel A Mussman. All rights reserved.
//
// This is a simple workforce-identity application serving as the supplier to order coffee. The
// point is to demonstrate obtaining identity and single sign-on for WIAM with Okta as the
// identity provider.
//
// This application should be configured with OIDC as a traditional web application in the Okta
// org. Configure four enviornment variables before launching the application with "npm start":
//
//	APP_PORT			the port the application should listen for connections on.
//	OKTA_CLIENT_ID		the client ID value for the application registered in the Okta org.
//	OKTA_CLIENT_SECRET	The secret credentials for the client
//	OKTA_ORG_URI		The full URI including the protocol to the Okta org: https://...
//

import express from 'express'
import { engine } from 'express-handlebars';
import session from 'express-session'
import oidcMiddleware from '@okta/oidc-middleware'
const { ExpressOIDC } = oidcMiddleware;

const port = process.env.APP_PORT ? process.env.APP_PORT : 8081
const orgUri = process.env.OKTA_ORG_URI
const clientId = process.env.OKTA_CLIENT_ID
const clientSecret = process.env.OKTA_CLIENT_SECRET
const debug = true;

// The exported function is called from server.js to launch.

export default () => {

	// Create the Express app instance.

	const app = express()

	// Set the source for static files.

	app.use(express.static('src/static'))

	// Setup the handlebars engine for HTML templates.

	app.engine('handlebars', engine());
	app.set('view engine', 'handlebars');
	app.set('views', './src/views');

	// Configure sessions, this is an OIDC middleware dependency.

	app.use(session({

		name: "tc3-rewards-sid",
		secret: 'not-so-random-but-this-is-an-example',
		resave: true,
		saveUninitialized: false,
		unset: 'destroy'
	}));

	// Create the Okta OIDC middleware instance; see https://github.com/okta/okta-oidc-middleware,
	// and register it.

	const oidc = new ExpressOIDC({

		issuer: `${orgUri}`,
		client_id: `${clientId}`,
		client_secret: `${clientSecret}`,
		appBaseUrl: `http://localhost:${port}`,
		scope: 'openid profile'
	})

	app.use(oidc.router);

	// Register a handler for the / landing page. If the user is not already authenticated
	// this will redirect the browser to authenticate and return identity.

	app.get('/', (req, res) => {

		if (debug) console.log('/ requested from', req.ip)

		// Pick four random coffees.

		let coffees = []
		for (let i = 0; i < 4; i++) {

			coffees[i] = (Math.floor(Math.random() * 12) + 1).toString().padStart(2, '0')
		}

		// Render triggers the Handlebars engine to format the home template into the main layout:

		let discount = Math.floor(Math.random() * 11) + 5

		res.render('home', {
			name: req.userContext?.userinfo?.name,
			discount: discount,
			basePrice: (8.95 * ((100 - discount) / 100)).toFixed(2),
			product: coffees
		})
	})

	// Register a /logout handler to log out and land back on the home page. This is a WIAM
	// so logging out destroys the application session and leaves the Okta session intact.
	// Clicking the login button with an active Okta session will log in the user without
	// authentication.
	//
	// The /logout endpoint registered by oidc-middleware canis not used because:
	//	a) It is registered for a POST.
	//	b) It will destroy the Okta session and that is not desired for WIAM.

	app.get('/logout', (req, res) => {

		delete req.session;
		res.redirect('/');
	})

	// The application cannot launch until the OIDC middleware is ready, so this callback
	// will execute when that happens and start Express listening.

	oidc.on('ready', () => {

		app.listen(port, () => {
		
			console.log(`listening on port ${port}`)
		})
	})

	// Any error in the OIDC middleware will land on this callback.

	oidc.on('error', err => {

		console.log(err);
	})
}