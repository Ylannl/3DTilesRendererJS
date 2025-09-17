import {
	Scene,
	WebGLRenderer,
	PerspectiveCamera,
	Vector3
} from 'three';
import { TilesRenderer, GlobeControls } from '3d-tiles-renderer';
import { TilesFadePlugin, UpdateOnChangePlugin, WMTSCapabilitiesLoader, WMTSTilesPlugin } from '3d-tiles-renderer/plugins';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';

const WMTSSources = [
	{
		name: 'OpenBasisKaart',
		defaultLayer: 'osm-epsg3857',
		url: 'https://www.openbasiskaart.nl/mapcache/wmts/?SERVICE=WMTS&REQUEST=GETCAPABILITIES',
	},
	{
		name: 'PDOK Luchtfoto',
		url: 'https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0?request=GetCapabilities&service=WMTS',
	},
	{
		name: 'PDOK Achtergrondkaart',
		url: 'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0?request=GetCapabilities&service=WMTS',
	},
	{
		name: 'PDOK Kadaster KadastraleKaart',
		url: 'https://service.pdok.nl/kadaster/kadastralekaart/wmts/v5_0?request=GetCapabilities&service=WMTS',
	},
	{
		name: 'PDOK Kadaster BGT',
		url: 'https://service.pdok.nl/lv/bgt/wmts/v1_0?request=GetCapabilities&service=WMTS',
	},
];

let controls, scene, renderer;
let tiles, camera, gui;
let params, capabilities;

let cameraPos = new Vector3( 3971364.928846245, 4968792.282701428, - 250499.79677567462 );
let cameraRotation = new Vector3( - 1.6208314773574481, 0.6704074335198622, 1.6443201998953914 );

init();
render();

function init() {

	// renderer
	renderer = new WebGLRenderer( { antialias: true } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setClearColor( 0x111111 );
	renderer.setAnimationLoop( render );

	document.body.appendChild( renderer.domElement );

	// scene
	scene = new Scene();

	// set up cameras and ortho / perspective transition
	camera = new PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.001, 10000 );

	// update the capabilities file
	updateCapabilities( WMTSSources[ 1 ] );

	// events
	onWindowResize();
	window.addEventListener( 'resize', onWindowResize, false );
	window.addEventListener( 'hashchange', () => location.reload() );

}

async function updateCapabilities( source ) {

	// load the capabilities file
	capabilities = await new WMTSCapabilitiesLoader().loadAsync( source.url );

	// use a default overlay
	let defaultLayer = source.defaultLayer;
	if ( ! capabilities.layers.find( l => l.identifier === defaultLayer ) ) {

		defaultLayer = capabilities.layers[ 0 ].identifier;

	}

	// set up the parameters
	params = {
		wmtsSource: source.name,
		layer: defaultLayer,
		style: null,
		tileMatrixSet: null,
		dimensions: {},
	};

	rebuildGUI();
	rebuildTiles();

}

function rebuildGUI() {

	if ( gui ) {

		gui.destroy();

	}

	params.style = null;
	params.tileMatrixSet = null;
	params.dimensions = {};

	// initialize the layer settings
	const layer = capabilities.layers.find( l => l.identifier === params.layer );
	params.style = layer.styles[ 0 ].identifier;
	const epsg3857TileMatrixSet = layer.tileMatrixSets.find( tms => tms.supportedCRS === 'EPSG:3857' );
	params.tileMatrixSet = epsg3857TileMatrixSet ? epsg3857TileMatrixSet.identifier : layer.tileMatrixSets[ 0 ].identifier;

	// update the ui
	const abstract = capabilities.serviceIdentification.abstract;
	document.getElementById( 'info' ).innerHTML =
		'<b>' + capabilities.serviceIdentification.title + '</b>' + ( abstract ? '<br/>' + abstract : '' ) +
		'<br/>' + layer.title;


	gui = new GUI();
	gui.add( params, 'wmtsSource', WMTSSources.map( s => s.name ) ).onChange( () => {

		const src = WMTSSources.find( s => s.name === params.wmtsSource );
		updateCapabilities( src );

	} );
	gui.add( params, 'layer', capabilities.layers.map( l => l.identifier ) ).onChange( () => {

		rebuildGUI();
		rebuildTiles();

	} );
	gui.add( params, 'tileMatrixSet', layer.tileMatrixSets.map( tms => tms.identifier ) ).onChange( rebuildTiles );
	gui.add( params, 'style', layer.styles.map( s => s.identifier ) ).onChange( rebuildTiles );

}

function rebuildTiles() {

	if ( tiles ) {

		tiles.dispose();

	}

	if ( controls ) {

		cameraPos = controls.camera.position;
		cameraRotation = controls.camera.rotation;
		controls.dispose();
		controls = null;

	}

	// tiles
	tiles = new TilesRenderer();
	tiles.registerPlugin( new TilesFadePlugin() );
	tiles.registerPlugin( new UpdateOnChangePlugin() );
	tiles.registerPlugin( new WMTSTilesPlugin( {
		shape: 'ellipsoid',
		center: true,
		capabilities,
		...params,
	} ) );
	tiles.errorTarget = 1.5;

	tiles.setCamera( camera );
	tiles.group.rotation.x = - Math.PI / 2;
	scene.add( tiles.group );

	// create the controls
	controls = new GlobeControls( scene, camera, renderer.domElement );
	controls.setEllipsoid( tiles.ellipsoid, tiles.group );
	controls.enableDamping = true;
	controls.camera.position.set( cameraPos.x, cameraPos.y, cameraPos.z );
	controls.camera.rotation.set( cameraRotation.x, cameraRotation.y, cameraRotation.z );
	controls.minDistance = 100;

}

function onWindowResize() {

	const aspect = window.innerWidth / window.innerHeight;
	camera.aspect = aspect;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function render() {

	if ( controls ) {

		controls.update();
		camera.updateMatrixWorld();

	}

	if ( tiles ) {

		tiles.setCamera( camera );
		tiles.setResolutionFromRenderer( camera, renderer );
		tiles.update();

	}

	renderer.render( scene, camera );

}
