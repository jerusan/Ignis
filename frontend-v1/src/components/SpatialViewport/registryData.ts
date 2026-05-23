import type { SpatialControlPoint, MachineView } from '../../types/chat';

export const WELDER_FRONT_REGISTRY: Record<string, SpatialControlPoint> = {
    "home_button": {
        x: 352,
        y: 401,
        radius: 23,
        title: "Home Button",
        desc: "Returns the user interface to the main home screen or default menu."
    },
    "back_button": {
        x: 641,
        y: 399,
        radius: 25,
        title: "Back Button",
        desc: "Navigates back to the previous screen or menu level in the user interface."
    },
    "lcd_display": {
        x: 496,
        y: 380,
        radius: 46,
        title: "LCD Display",
        desc: "Shows the current welding parameters, settings, status messages, and menu options."
    },
    "control_knob": {
        x: 501,
        y: 504,
        radius: 33,
        title: "Control Knob",
        desc: "A central rotary knob used to navigate menus, adjust settings, and make selections."
    },
    "left_knob": {
        x: 387,
        y: 501,
        radius: 26,
        title: "Left Knob",
        desc: "A side-mounted knob, likely used to adjust specific parameters such as voltage or wire feed speed."
    },
    "right_knob": {
        x: 610,
        y: 500,
        radius: 28,
        title: "Right Knob",
        desc: "A side-mounted knob, likely used to adjust complementary parameters or settings."
    },
    "power_switch": {
        x: 469,
        y: 686,
        radius: 25,
        title: "Power Switch",
        desc: "The main toggle switch to turn the welder's power on or off."
    },
    "mig_gun_spool_gun_cable_socket": {
        x: 402,
        y: 806,
        radius: 25,
        title: "MIG Gun / Spool Gun Cable Socket",
        desc: "Connector port for attaching the MIG or Spool Gun cable to the welder."
    },
    "spool_gun_gas_outlet": {
        x: 346,
        y: 702,
        radius: 33,
        title: "Spool Gun Gas Outlet",
        desc: "Port for connecting the gas supply line when using a Spool Gun for MIG welding."
    },
    "positive_socket": {
        x: 645,
        y: 805,
        radius: 30,
        title: "Positive Socket",
        desc: "Terminal for connecting the positive output cable, typically to the workpiece or ground clamp."
    },
    "negative_socket": {
        x: 503,
        y: 808,
        radius: 30,
        title: "Negative Socket",
        desc: "Terminal for connecting the negative output cable, typically to the welding torch or gun."
    },
    "wire_feed_power_cable": {
        x: 570,
        y: 837,
        radius: 21,
        title: "Wire Feed Power Cable",
        desc: "Cable that supplies power to the wire feed mechanism, often connected to the welding gun."
    },
    "storage_compartment": {
        x: 495,
        y: 592,
        radius: 26,
        title: "Storage Compartment",
        desc: "Internal or external compartment for storing accessories, manuals, or small tools."
    }
};

export const WELDER_INTERIOR_REGISTRY: Record<string, SpatialControlPoint> = {
    "wire_spool": {
        x: 354,
        y: 651,
        radius: 25,
        title: "Wire Spool",
        desc: "The cylindrical holder that contains the welding wire. It rotates as wire is fed and is mounted on the spool shaft."
    },
    "spool_knob": {
        x: 406,
        y: 723,
        radius: 45,
        title: "Spool Knob",
        desc: "Used to secure or release the wire spool for loading or changing wire. Rotates to lock or unlock the spool in place."
    },
    "wire_inlet_liner": {
        x: 585,
        y: 672,
        radius: 20,
        title: "Wire Inlet Liner",
        desc: "A guide tube or liner at the wire entry point that ensures smooth wire transition into the feed mechanism and reduces friction or binding."
    },
    "cold_wire_feed_switch": {
        x: 653,
        y: 552,
        radius: 12,
        title: "Cold Wire Feed Switch",
        desc: "A toggle or button that allows the user to manually advance wire without initiating an arc (cold feed), useful for threading or testing wire feed."
    },
    "wire_feed_control_socket": {
        x: 723,
        y: 806,
        radius: 20,
        title: "Wire Feed Control Socket",
        desc: "A connector port for attaching an external wire feed control device, such as a remote hand-held control or a separate feed unit."
    },
    "wire_feed_mechanism": {
        x: 606,
        y: 635,
        radius: 15,
        title: "Wire Feed Mechanism",
        desc: "The internal assembly of gears, rollers, and motors that drives the wire from the spool through the gun. It is the core component for wire feeding."
    },
    "foot_pedal_socket": {
        x: 671,
        y: 797,
        radius: 18,
        title: "Foot Pedal Socket",
        desc: "A connector port for plugging in an external foot pedal, allowing hands-free control of welding output or wire feed start/stop."
    },
    "feed_roller_knob": {
        x: 658,
        y: 724,
        radius: 21,
        title: "Feed Roller Knob",
        desc: "Adjusts the pressure of the feed rollers against the welding wire to ensure proper wire feeding. Turning it changes the grip force on the wire."
    },
    "idler_arm": {
        x: 686,
        y: 654,
        radius: 14,
        title: "Idler Arm",
        desc: "A mechanical arm that applies pressure to the wire via the idler roller. It is often spring-loaded and works in conjunction with the feed rollers to guide the wire."
    },
    "feed_tensioner": {
        x: 653,
        y: 614,
        radius: 16,
        title: "Feed Tensioner",
        desc: "Adjusts the tension applied to the welding wire as it is fed through the system. Proper tension prevents wire slippage or over-pulling."
    }
};

export const WELDER_REAR_REGISTRY: Record<string, SpatialControlPoint> = {
    "power_input_socket": {
        x: 353,
        y: 367,
        radius: 88,
        title: "Power Input Socket",
        desc: "The main AC power input for the welder, where the power cord is connected to supply electricity to the unit."
    },
    "cooling_fan": {
        x: 412,
        y: 810,
        radius: 166,
        title: "Cooling Fan",
        desc: "A fan that helps dissipate heat generated by the welder's internal components during operation."
    },
    "gas_inlet": {
        x: 302,
        y: 540,
        radius: 41,
        title: "Gas Inlet",
        desc: "The point where shielding gas is connected to the welder for protection of the weld zone."
    },
    "reset_button": {
        x: 427,
        y: 540,
        radius: 22,
        title: "Reset Button",
        desc: "A button that resets the welder to its default settings."
    }
};

export const REGISTRY_BY_VIEW: Record<MachineView, Record<string, SpatialControlPoint>> = {
    front: WELDER_FRONT_REGISTRY,
    interior: WELDER_INTERIOR_REGISTRY,
    back: WELDER_REAR_REGISTRY,
};
