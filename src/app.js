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

// The exported function is called from server.js to launch. It is exported as the
// default export of the module, so the client code using it can import it with
// whatever name is required. In this example server.js imports it as "start".

export default () => {

	// Create the Express app instance.

	const app = express()

	// The static middleware component registers the source of static files; whenever the browser
	// requests a static file (image, style sheet, etc.) it will be served from here.

	app.use(express.static('src/static'))

	// Setup the handlebars engine for HTML templates. Handlebars templates have placeholders which
	// are merged with data when the page is sent to the user.

	app.engine('handlebars', engine());
	app.set('view engine', 'handlebars');
	app.set('views', './src/views');

	// Configure sessions, this is an Okta OIDC middleware dependency, it's where it saves things
	// between requests.

	app.use(session({

		name: "tc3-rewards-sid",
		secret: 'not-so-random-but-this-is-an-example',
		resave: true,
		saveUninitialized: false,
		unset: 'destroy'
	}));

	// Create the Okta OIDC middleware instance; see https://github.com/okta/okta-oidc-middleware,
	// and register it. The middleware creates a /login endpoint which starts and auth code flow
	// when called, an /authorization-code/callback endpoint which handles the alpha code and a
	// /logout (POST) callback that will log the user out of the Okta org. /login is called when
	// the user clicks the button presented by the template main.handlebars.

	const oidc = new ExpressOIDC({

		issuer: `${orgUri}`,
		client_id: `${clientId}`,
		client_secret: `${clientSecret}`,
		appBaseUrl: `http://localhost:${port}`,
		scope: 'openid profile'
	})

	app.use(oidc.router);

	// Register a handler for the / landing page. The page shows a random selection of coffees
	// without prices, unless the user is authenticated in which case prices are shown. The
	// button to login (or logout) is in the boilerplate in main.handlebars, and sends the browser to
	// /login to initiate an OIDC authorization code flow. The entire flow is handled in the middleware.

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
	// application so logging out destroys the local session but leaves the Okta session intact.
	// The main.handlebars template changes the login button to logout when the application
	// has an id token. The logout button calls this endpoint.
	//
	// After logout clicking the login button with an active Okta session will retrieve an
	// id token but the user will not be required to re-authenticate.
	//
	// The /logout endpoint registered by oidc-middleware is not used because:
	//	a) It is registered for a POST action.
	//	b) It will destroy the Okta session and that is not desired for WIAM.

	app.get('/logout', (req, res) => {

		delete req.session;
		res.redirect('/');
	})

	// The application cannot launch until the Okta OIDC middleware is ready, so this callback
	// delays proceeding until that happens, and then starts Express listening for connections.

	oidc.on('ready', () => {

		app.listen(port, () => {
		
			console.log(`listening on port ${port}`)
		})
	})

	// Any error occuring in the Okta OIDC middleware will land on this callback.

	oidc.on('error', err => {

		console.log(err);
	})
}