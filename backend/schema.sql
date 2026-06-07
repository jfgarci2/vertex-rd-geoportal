-- VERTEX RD — PostGIS schema
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS predios (
    id              SERIAL PRIMARY KEY,
    codigo          VARCHAR(20),
    catastro        VARCHAR(50) UNIQUE NOT NULL,
    codigo_alt      VARCHAR(30),
    act_uso_co      VARCHAR(10),
    uso             VARCHAR(50),
    estrato         SMALLINT,
    actividad       VARCHAR(100),
    estado_des      VARCHAR(50),
    equipamien      VARCHAR(100),
    areapredio      DOUBLE PRECISION,
    barrio          VARCHAR(100),
    sub_barrio      VARCHAR(100),
    distrito        VARCHAR(100),
    poligono        VARCHAR(50),
    ut              VARCHAR(50),
    nombre_ut       VARCHAR(100),
    categoria       VARCHAR(50),
    tipos           VARCHAR(20),
    id_densidades   VARCHAR(20),
    id_retiros      VARCHAR(10),
    bp              VARCHAR(10),
    geom            GEOMETRY(MultiPolygon, 4326)
);

CREATE INDEX IF NOT EXISTS idx_predios_catastro ON predios (catastro);
CREATE INDEX IF NOT EXISTS idx_predios_barrio ON predios (barrio);
CREATE INDEX IF NOT EXISTS idx_predios_geom ON predios USING GIST (geom);

CREATE TABLE IF NOT EXISTS densidades (
    id_densidades   VARCHAR(10) PRIMARY KEY,
    categoria       VARCHAR(20),
    tipo            VARCHAR(20),
    altura_max_niveles SMALLINT,
    altura_max_metros  DOUBLE PRECISION,
    usos_permitidos TEXT,
    data            JSONB
);

CREATE TABLE IF NOT EXISTS retiros (
    id_retiros      VARCHAR(10),
    rango_niveles   VARCHAR(20),
    densidad        VARCHAR(20),
    lote_minimo_m2  VARCHAR(20),
    retiro_frontal  DOUBLE PRECISION,
    retiro_lateral  DOUBLE PRECISION,
    retiro_posterior DOUBLE PRECISION,
    retiro_entre_edificios DOUBLE PRECISION,
    PRIMARY KEY (id_retiros, rango_niveles)
);

CREATE TABLE IF NOT EXISTS densidades_renacimiento (
    id_densidades   VARCHAR(10),
    rango_area_m2   VARCHAR(20),
    densidad_hab_ha DOUBLE PRECISION,
    edificabilidad  DOUBLE PRECISION,
    ocupacion_pct   DOUBLE PRECISION,
    niveles_max     SMALLINT,
    altura_max_m    DOUBLE PRECISION,
    retiro_frente_m DOUBLE PRECISION,
    retiro_laterales_m DOUBLE PRECISION,
    retiro_posterior_m DOUBLE PRECISION,
    observaciones   TEXT,
    PRIMARY KEY (id_densidades, rango_area_m2)
);
