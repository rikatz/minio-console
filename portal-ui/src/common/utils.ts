// This file is part of MinIO Console Server
// Copyright (c) 2021 MinIO, Inc.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

import storage from "local-storage-fallback";
import { ICapacity, IErasureCodeCalc, IStorageFactors } from "./types";
import { IPool } from "../screens/Console/Tenants/ListTenants/types";

const minStReq = 1073741824; // Minimal Space required for MinIO
const minMemReq = 2147483648; // Minimal Memory required for MinIO in bytes

export const units = [
  "B",
  "KiB",
  "MiB",
  "GiB",
  "TiB",
  "PiB",
  "EiB",
  "ZiB",
  "YiB",
];
export const k8sUnits = ["Ki", "Mi", "Gi", "Ti", "Pi", "Ei"];
export const k8sCalcUnits = ["B", ...k8sUnits];

export const niceBytes = (x: string, showK8sUnits: boolean = false) => {
  let n = parseInt(x, 10) || 0;

  return niceBytesInt(n, showK8sUnits);
};

export const niceBytesInt = (n: number, showK8sUnits: boolean = false) => {
  let l = 0;

  while (n >= 1024 && ++l) {
    n = n / 1024;
  }
  //include a decimal point and a tenths-place digit if presenting
  //less than ten of KB or greater units
  const k8sUnitsN = ["B", ...k8sUnits];
  return (
    n.toFixed(n < 10 && l > 0 ? 1 : 0) +
    " " +
    (showK8sUnits ? k8sUnitsN[l] : units[l])
  );
};

export const setCookie = (name: string, val: string) => {
  const date = new Date();
  const value = val;

  // Set it expire in 45 minutes
  date.setTime(date.getTime() + 45 * 60 * 1000);

  // Set it
  document.cookie =
    name + "=" + value + "; expires=" + date.toUTCString() + "; path=/";
};

export const deleteCookie = (name: string) => {
  document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
};

export const clearSession = () => {
  storage.removeItem("token");
  deleteCookie("token");
};

// timeFromDate gets time string from date input
export const timeFromDate = (d: Date) => {
  let h = d.getHours() < 10 ? `0${d.getHours()}` : `${d.getHours()}`;
  let m = d.getMinutes() < 10 ? `0${d.getMinutes()}` : `${d.getMinutes()}`;
  let s = d.getSeconds() < 10 ? `0${d.getSeconds()}` : `${d.getSeconds()}`;

  return `${h}:${m}:${s}:${d.getMilliseconds()}`;
};

// units to be used in a dropdown
export const factorForDropdown = () => {
  return units.map((unit) => {
    return { label: unit, value: unit };
  });
};

// units to be used in a dropdown
export const k8sfactorForDropdown = () => {
  return k8sUnits.map((unit) => {
    return { label: unit, value: unit };
  });
};

//getBytes, converts from a value and a unit from units array to bytes
export const getBytes = (
  value: string,
  unit: string,
  fromk8s: boolean = false
) => {
  const vl: number = parseFloat(value);

  const unitsTake = fromk8s ? k8sCalcUnits : units;

  const powFactor = unitsTake.findIndex((element) => element === unit);

  if (powFactor === -1) {
    return "0";
  }
  const factor = Math.pow(1024, powFactor);
  const total = vl * factor;

  return total.toString(10);
};

//getTotalSize gets the total size of a value & unit
export const getTotalSize = (value: string, unit: string) => {
  const bytes = getBytes(value, unit, true).toString();
  return niceBytes(bytes);
};

export const setMemoryResource = (
  memorySize: number,
  capacitySize: string,
  maxMemorySize: number
) => {
  // value always comes as Gi
  const requestedSizeBytes = getBytes(memorySize.toString(10), "Gi", true);
  const memReqSize = parseInt(requestedSizeBytes, 10);
  if (maxMemorySize === 0) {
    return {
      error: "There is no memory available for the selected number of nodes",
      request: 0,
      limit: 0,
    };
  }

  if (maxMemorySize < minMemReq) {
    return {
      error: "There are not enough memory resources available",
      request: 0,
      limit: 0,
    };
  }

  if (memReqSize < minMemReq) {
    return {
      error: "The requested memory size must be greater than 2Gi",
      request: 0,
      limit: 0,
    };
  }
  if (memReqSize > maxMemorySize) {
    return {
      error:
        "The requested memory is greater than the max available memory for the selected number of nodes",
      request: 0,
      limit: 0,
    };
  }

  const capSize = parseInt(capacitySize, 10);
  let memLimitSize = memReqSize;
  // set memory limit based on the capacitySize
  // if capacity size is lower than 1TiB we use the limit equal to request
  if (capSize >= parseInt(getBytes("1", "Pi", true), 10)) {
    memLimitSize = Math.max(
      memReqSize,
      parseInt(getBytes("64", "Gi", true), 10)
    );
  } else if (capSize >= parseInt(getBytes("100", "Ti"), 10)) {
    memLimitSize = Math.max(
      memReqSize,
      parseInt(getBytes("32", "Gi", true), 10)
    );
  } else if (capSize >= parseInt(getBytes("10", "Ti"), 10)) {
    memLimitSize = Math.max(
      memReqSize,
      parseInt(getBytes("16", "Gi", true), 10)
    );
  } else if (capSize >= parseInt(getBytes("1", "Ti"), 10)) {
    memLimitSize = Math.max(
      memReqSize,
      parseInt(getBytes("8", "Gi", true), 10)
    );
  }

  return {
    error: "",
    request: memReqSize,
    limit: memLimitSize,
  };
};

export const calculateDistribution = (
  capacityToUse: ICapacity,
  forcedNodes: number = 0,
  limitSize: number = 0,
  drivesPerServer: number = 0
) => {
  let numberOfNodes = {};
  const requestedSizeBytes = getBytes(
    capacityToUse.value,
    capacityToUse.unit,
    true
  );

  if (parseInt(requestedSizeBytes, 10) < minStReq) {
    return {
      error: "The pool size must be greater than 1Gi",
      nodes: 0,
      persistentVolumes: 0,
      disks: 0,
      pvSize: 0,
    };
  }

  if (drivesPerServer <= 0) {
    return {
      error: "Number of drives must be at least 1",
      nodes: 0,
      persistentVolumes: 0,
      disks: 0,
      pvSize: 0,
    };
  }

  numberOfNodes = calculateStorage(
    requestedSizeBytes,
    forcedNodes,
    limitSize,
    drivesPerServer
  );

  return numberOfNodes;
};

const calculateStorage = (
  requestedBytes: string,
  forcedNodes: number,
  limitSize: number,
  drivesPerServer: number
) => {
  // Size validation
  const intReqBytes = parseInt(requestedBytes, 10);
  const maxDiskSize = minStReq * 256; // 256 GiB

  // We get the distribution
  return structureCalc(
    forcedNodes,
    intReqBytes,
    maxDiskSize,
    limitSize,
    drivesPerServer
  );
};

const structureCalc = (
  nodes: number,
  desiredCapacity: number,
  maxDiskSize: number,
  maxClusterSize: number,
  disksPerNode: number = 0
) => {
  if (
    isNaN(nodes) ||
    isNaN(desiredCapacity) ||
    isNaN(maxDiskSize) ||
    isNaN(maxClusterSize)
  ) {
    return {
      error: "Some provided data is invalid, please try again.",
      nodes: 0,
      persistentVolumes: 0,
      disks: 0,
      volumePerDisk: 0,
    }; // Invalid Data
  }

  let persistentVolumeSize = 0;
  let numberPersistentVolumes = 0;
  let volumesPerServer = 0;

  if (disksPerNode === 0) {
    persistentVolumeSize = Math.floor(
      Math.min(desiredCapacity / Math.max(4, nodes), maxDiskSize)
    ); // pVS = min((desiredCapacity / max(4 | nodes)) | maxDiskSize)

    numberPersistentVolumes = desiredCapacity / persistentVolumeSize; // nPV = dC / pVS
    volumesPerServer = numberPersistentVolumes / nodes; // vPS = nPV / n
  }

  if (disksPerNode) {
    volumesPerServer = disksPerNode;
    numberPersistentVolumes = volumesPerServer * nodes;
    persistentVolumeSize = Math.floor(
      desiredCapacity / numberPersistentVolumes
    );
  }

  // Volumes are not exact, we force the volumes number & minimize the volume size
  if (volumesPerServer % 1 > 0) {
    volumesPerServer = Math.ceil(volumesPerServer); // Increment of volumes per server
    numberPersistentVolumes = volumesPerServer * nodes; // nPV = vPS * n
    persistentVolumeSize = Math.floor(
      desiredCapacity / numberPersistentVolumes
    ); // pVS = dC / nPV

    const limitSize = persistentVolumeSize * volumesPerServer * nodes; // lS = pVS * vPS * n

    if (limitSize > maxClusterSize) {
      return {
        error: "We were not able to allocate this server.",
        nodes: 0,
        persistentVolumes: 0,
        disks: 0,
        volumePerDisk: 0,
      }; // Cannot allocate this server
    }
  }

  if (persistentVolumeSize < minStReq) {
    return {
      error:
        "Disk Size with this combination would be less than 1Gi, please try another combination",
      nodes: 0,
      persistentVolumes: 0,
      disks: 0,
      volumePerDisk: 0,
    }; // Cannot allocate this volume size
  }

  return {
    error: "",
    nodes,
    persistentVolumes: numberPersistentVolumes,
    disks: volumesPerServer,
    pvSize: persistentVolumeSize,
  };
};

// Erasure Code Parity Calc
export const erasureCodeCalc = (
  parityValidValues: string[],
  totalDisks: number,
  pvSize: number,
  totalNodes: number
): IErasureCodeCalc => {
  // Parity Values is empty
  if (parityValidValues.length < 1) {
    return {
      error: 1,
      defaultEC: "",
      erasureCodeSet: 0,
      maxEC: "",
      rawCapacity: "0",
      storageFactors: [],
    };
  }

  const totalStorage = totalDisks * pvSize;
  const maxEC = parityValidValues[0];
  const maxParityNumber = parseInt(maxEC.split(":")[1], 10);

  const erasureStripeSet = maxParityNumber * 2; // ESS is calculated by multiplying maximum parity by two.

  const storageFactors: IStorageFactors[] = parityValidValues.map(
    (currentParity) => {
      const parityNumber = parseInt(currentParity.split(":")[1], 10);
      const storageFactor =
        erasureStripeSet / (erasureStripeSet - parityNumber);

      const maxCapacity = Math.floor(totalStorage / storageFactor);
      const maxTolerations =
        totalDisks - Math.floor(totalDisks / storageFactor);
      return {
        erasureCode: currentParity,
        storageFactor,
        maxCapacity: maxCapacity.toString(10),
        maxFailureTolerations: maxTolerations,
      };
    }
  );

  let defaultEC = maxEC;

  const fourVar = parityValidValues.find((element) => element === "EC:4");

  if (totalDisks >= 8 && totalNodes > 16 && fourVar) {
    defaultEC = "EC:4";
  }

  return {
    error: 0,
    storageFactors,
    maxEC,
    rawCapacity: totalStorage.toString(10),
    erasureCodeSet: erasureStripeSet,
    defaultEC,
  };
};

// Pool Name Generator
export const generatePoolName = (pools: IPool[]) => {
  const poolCounter = pools.length;

  return `pool-${poolCounter}`;
};

// seconds / minutes /hours / Days / Years calculator
export const niceDays = (secondsValue: string, timeVariant: string = "s") => {
  let seconds = parseFloat(secondsValue);

  return niceDaysInt(seconds, timeVariant);
};

export const niceDaysInt = (seconds: number, timeVariant: string = "s") => {
  switch (timeVariant) {
    case "ns":
      seconds = Math.floor(seconds * 0.000000001);
      break;
    case "ms":
      seconds = Math.floor(seconds * 0.001);
      break;
    default:
  }

  const days = Math.floor(seconds / (3600 * 24));

  seconds -= days * 3600 * 24;
  const hours = Math.floor(seconds / 3600);
  seconds -= hours * 3600;
  const minutes = Math.floor(seconds / 60);
  seconds -= minutes * 60;

  if (days > 365) {
    const years = days / 365;
    return `${years} year${Math.floor(years) === 1 ? "" : "s"}`;
  }

  if (days > 30) {
    const months = Math.floor(days / 30);
    const diffDays = days - months * 30;

    return `${months} month${Math.floor(months) === 1 ? "" : "s"} ${
      diffDays > 0 ? `${diffDays} day${diffDays > 1 ? "s" : ""}` : ""
    }`;
  }

  if (days >= 7 && days <= 30) {
    const weeks = Math.floor(days / 7);

    return `${Math.floor(weeks)} week${weeks === 1 ? "" : "s"}`;
  }

  if (days >= 1 && days <= 6) {
    return `${days} day${days > 1 ? "s" : ""}`;
  }

  return `${hours >= 1 ? `${hours} hour${hours > 1 ? "s" : ""}` : ""} ${
    minutes >= 1 && hours === 0
      ? `${minutes} minute${minutes > 1 ? "s" : ""}`
      : ""
  } ${
    seconds >= 1 && minutes === 0 && hours === 0
      ? `${seconds} second${seconds > 1 ? "s" : ""}`
      : ""
  }`;
};

export const getTimeFromTimestamp = (
  timestamp: string,
  fullDate: boolean = false
) => {
  const dateObject = new Date(parseInt(timestamp) * 1000);

  if (fullDate) {
    return `${dateObject.getFullYear()}-${String(
      dateObject.getMonth() + 1
    ).padStart(2, "0")}-${String(dateObject.getDay()).padStart(
      2,
      "0"
    )} ${dateObject.getHours()}:${String(dateObject.getMinutes()).padStart(
      2,
      "0"
    )}:${String(dateObject.getSeconds()).padStart(2, "0")}`;
  }
  return `${dateObject.getHours()}:${String(dateObject.getMinutes()).padStart(
    2,
    "0"
  )}`;
};

export const calculateBytes = (
  x: string,
  showDecimals = false,
  roundFloor = true
) => {
  const bytes = parseInt(x, 10);

  if (bytes === 0) {
    return { total: 0, unit: units[0] };
  }

  // Gi : GiB
  const k = 1024;

  // Get unit for measure
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  const fractionDigits = showDecimals ? 0 : 1;

  const bytesUnit = bytes / Math.pow(k, i);

  const roundedUnit = roundFloor ? Math.floor(bytesUnit) : bytesUnit;

  // Get Unit parsed
  const unitParsed = parseFloat(roundedUnit.toFixed(fractionDigits));
  const finalUnit = units[i];

  return { total: unitParsed, unit: finalUnit };
};

export const nsToSeconds = (nanoseconds: number) => {
  const conversion = nanoseconds * 0.000000001;
  const round = Math.round((conversion + Number.EPSILON) * 10000) / 10000;

  return `${round} s`;
};

export const textToRGBColor = (text: string) => {
  const splitText = text.split("");

  const hashVl = splitText.reduce((acc, currItem) => {
    return acc + currItem.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);

  const hashColored = ((hashVl * 100) & 0x00ffffff).toString(16).toUpperCase();

  return `#${hashColored.padStart(6, "0")}`;
};
